/**
 * Go modules as release packages, opt-in through `release.go.discover`.
 *
 * The modules are the `use` entries of a `go.work` file in the workspace root, or
 * the root `go.mod` when there is no `go.work`. Each module is named by its module
 * path. There is no version field in Go: a module's version is the highest git tag
 * for it, so discovery reads the tags. A module with no tag yet starts at `0.0.0`.
 * A module with a `/vN` path suffix (N >= 2) has no such baseline: its first tag
 * must already exist, and the release refuses until one does.
 *
 * Tag names follow https://go.dev/ref/mod#vcs-version: a module in a subdirectory
 * is tagged `&lt;subdir>/vX.Y.Z`, where `&lt;subdir>` is the directory relative to the git
 * toplevel without a trailing `/vN` segment. The root module is tagged `vX.Y.Z`.
 *
 * The release writes no file. The tag is created by the publish phase.
 */

import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import semver from "semver";

import { parseGoModModulePath, parseGoWorkUses } from "../../util/go-modules";
import { VisReleaseError } from "../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../types";
import { toRepoRelativePath } from "./git";
import type { CommandRunner } from "./package-managers/interface";
import { isValidPackageName } from "./security";
import { createShellRunner } from "./shell-runner";

/** One Go module as the release wave sees it. */
export interface GoProject {
    name: string;
    package: WorkspacePackage;
    /** Per-package config the orchestrator merges in: the tag pattern and the version resolver. */
    perPackage: PerPackageReleaseConfig;
    /** The `/vN` suffix major when the module path has one (N >= 2). */
    suffixMajor?: number;
}

const invalid = (file: string, message: string): VisReleaseError => new VisReleaseError({ code: "CONFIG_INVALID", file, message });

const readOptional = async (path: string): Promise<string | undefined> => {
    try {
        return await readFile(path, "utf8");
    } catch {
        return undefined;
    }
};

const escapeRegExp = (text: string): string => text.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);

/** Every `use` directory, as absolute paths. Refuses anything outside the workspace or not a module. */
const moduleDirectories = async (cwd: string): Promise<string[]> => {
    const work = await readOptional(join(cwd, "go.work"));

    if (work === undefined) {
        return (await readOptional(join(cwd, "go.mod"))) === undefined ? [] : [cwd];
    }

    const dirs: string[] = [];

    for (const entry of parseGoWorkUses(work)) {
        if (isAbsolute(entry)) {
            throw invalid(join(cwd, "go.work"), `go.work uses ${entry}, an absolute path. vis reads only directories inside the workspace.`);
        }

        const dir = resolve(cwd, entry);
        const rel = relative(cwd, dir);

        if (rel === ".." || rel.startsWith(`..${sep}`)) {
            throw invalid(join(cwd, "go.work"), `go.work uses ${entry}, which is outside the workspace.`);
        }

        if ((await readOptional(join(dir, "go.mod"))) === undefined) {
            throw invalid(join(cwd, "go.work"), `go.work uses ${entry}, which has no go.mod.`);
        }

        dirs.push(dir);
    }

    return dirs;
};

/**
 * Discover the Go modules under `cwd`. Returns nothing without a `go.work` or a root
 * `go.mod`. `claimedDirs` are module directories a JS package already releases.
 */
export const discoverGoProjects = async (options: {
    claimedDirs: ReadonlySet<string>;
    cwd: string;
    runner?: CommandRunner;
}): Promise<GoProject[]> => {
    const { claimedDirs, cwd } = options;
    const runner = options.runner ?? createShellRunner();
    const dirs = await moduleDirectories(cwd);

    if (dirs.length === 0) {
        return [];
    }

    const seen = new Map<string, string>();
    const projects: GoProject[] = [];

    for (const dir of dirs) {
        if (claimedDirs.has(dir)) {
            continue;
        }

        const goMod = join(dir, "go.mod");
        const raw = await readOptional(goMod);

        if (raw === undefined) {
            throw invalid(goMod, `${goMod} is missing.`);
        }

        const modulePath = parseGoModModulePath(raw);

        if (modulePath === undefined) {
            throw invalid(goMod, `${goMod} has no module directive.`);
        }

        if (modulePath.startsWith("gopkg.in/")) {
            throw invalid(goMod, `${modulePath} is a gopkg.in path. vis releases only modules whose tags follow the module path rules; release it with a shell tag.`);
        }

        if (!isValidPackageName(modulePath)) {
            throw invalid(goMod, `${modulePath} is not a valid release name. Module paths are lowercase segments of [a-z0-9._-] joined by "/".`);
        }

        const existing = seen.get(modulePath);

        if (existing !== undefined) {
            throw invalid(goMod, `${modulePath} is declared by both ${existing} and ${goMod}. A module path must be unique to release it.`);
        }

        seen.set(modulePath, goMod);

        const suffix = /\/v(\d+)$/u.exec(modulePath);

        if (suffix?.[1] !== undefined && Number(suffix[1]) < 2) {
            throw invalid(goMod, `${modulePath} ends in /v${suffix[1]}. Go allows a major version suffix only from v2 on.`);
        }

        const suffixMajor = suffix?.[1] === undefined ? undefined : Number(suffix[1]);

        // The module subdirectory is the directory relative to the git toplevel, without a trailing /vN segment.
        const repoRelative = await toRepoRelativePath({ cwd, runner }, dir);
        const segments = repoRelative.split("/").filter((part) => part !== "" && part !== ".");

        if (suffixMajor !== undefined && segments.at(-1) === `v${suffixMajor}`) {
            segments.pop();
        }

        const prefix = segments.length === 0 ? "" : `${segments.join("/")}/`;
        const version = await latestTagVersion(runner, dir, prefix, suffixMajor);

        if (version === undefined && suffixMajor !== undefined) {
            throw invalid(goMod, `${modulePath} needs a major version ${suffixMajor} tag before vis can release it. Create ${prefix}v${suffixMajor}.0.0 by hand, then re-run the release.`);
        }

        const resolved = version ?? "0.0.0";
        const tagPattern = `${prefix}v{version}`;

        projects.push({
            name: modulePath,
            package: {
                dir,
                ecosystem: "go",
                manifest: { dependencies: {}, name: modulePath, private: false, version: resolved },
                manifestPath: goMod,
                name: modulePath,
                private: false,
                version: resolved,
            },
            perPackage: {
                currentVersionResolver: "disk",
                managed: true,
                releaseTagPattern: tagPattern,
                versionActions: "go",
            },
            suffixMajor,
        });
    }

    return projects;
};

/**
 * The highest `vX.Y.Z` tag for a module, as a version. A `/vN` module only counts tags
 * with major N; a module with no suffix counts major 0 and 1 (Go allows no suffix on v0
 * or v1 only).
 */
export const latestTagVersion = async (runner: CommandRunner, dir: string, prefix: string, suffixMajor: number | undefined): Promise<string | undefined> => {
    const result = await runner.run("git", ["tag", "--list"], { cwd: dir, silent: true });

    if (result.exitCode !== 0) {
        return undefined;
    }

    const tagRe = new RegExp(String.raw`^${escapeRegExp(prefix)}v(\d+\.\d+\.\d+)$`, "u");
    const versions: string[] = [];

    for (const line of result.stdout.split("\n")) {
        const match = tagRe.exec(line.trim());

        if (match?.[1] === undefined || semver.valid(match[1]) === null) {
            continue;
        }

        const major = semver.major(match[1]);

        if (suffixMajor === undefined ? major <= 1 : major === suffixMajor) {
            versions.push(match[1]);
        }
    }

    return versions.length === 0 ? undefined : semver.rsort(versions)[0];
};
