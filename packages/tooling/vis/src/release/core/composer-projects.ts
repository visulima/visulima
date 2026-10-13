/**
 * Composer packages as release packages, opt-in through `release.composer.discover`.
 *
 * A package is a `composer.json` with a `"name": "vendor/package"` string. Composer
 * has no version field, and Packagist reads versions from the git tags of the
 * repository, so the version is the highest `vX.Y.Z` tag. A package with no tag yet
 * starts at `0.0.0`. The release writes no file; the tag is created by the publish phase.
 *
 * Packagist reads a package from the repository root, so only the root `composer.json`
 * can be released. A named `composer.json` in a subdirectory is refused: its tag would
 * sit in a repository Packagist never looks at. A `composer.json` without `name` is not
 * a package and is not released. A `"version"` key is refused, because Packagist
 * ignores it and it would drift from the tag.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import semver from "semver";

import { findComposerManifestDirs, parseComposerJson, requireKeys } from "../../util/composer";
import { VisReleaseError } from "../errors";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../types";
import type { CommandRunner } from "./package-managers/interface";
import { isValidPackageName } from "./security";
import { createShellRunner } from "./shell-runner";

/** One Composer package as the release wave sees it. */
export interface ComposerProject {
    name: string;
    package: WorkspacePackage;
    /** Per-package config the orchestrator merges in: the tag pattern and the version resolver. */
    perPackage: PerPackageReleaseConfig;
}

const invalid = (file: string, message: string): VisReleaseError => new VisReleaseError({ code: "CONFIG_INVALID", file, message });

/** Packagist's name form: lowercase `vendor/package`, segments joined by `-`, `.` or `_` (https://getcomposer.org/doc/04-schema.md#name). */
const COMPOSER_NAME = /^[a-z0-9]+(?:[_.-][a-z0-9]+)*\/[a-z0-9]+(?:[_.-][a-z0-9]+)*$/u;

/** The highest `vX.Y.Z` tag of the repository at `dir`, or undefined when there is none. */
export const latestComposerTag = async (runner: CommandRunner, dir: string): Promise<string | undefined> => {
    const result = await runner.run("git", ["tag", "--list"], { cwd: dir, silent: true });

    if (result.exitCode !== 0) {
        return undefined;
    }

    const versions: string[] = [];

    for (const line of result.stdout.split("\n")) {
        const match = /^v(\d+\.\d+\.\d+)$/u.exec(line.trim());

        if (match?.[1] !== undefined && semver.valid(match[1]) !== null) {
            versions.push(match[1]);
        }
    }

    return versions.length === 0 ? undefined : semver.rsort(versions)[0];
};

/**
 * Discover the Composer packages under `cwd` as release packages. `claimedDirs` are
 * directories a JS package already releases; they are skipped. Packages that depend on
 * another discovered package carry a `"*"` dependency, which orders the publish.
 */
export const discoverComposerProjects = async (options: {
    claimedDirs: ReadonlySet<string>;
    cwd: string;
    runner?: CommandRunner;
}): Promise<ComposerProject[]> => {
    const { claimedDirs } = options;
    const root = resolve(options.cwd);
    const runner = options.runner ?? createShellRunner();
    const found: { dir: string; manifest: Record<string, unknown>; manifestPath: string; name: string }[] = [];
    const names = new Map<string, string>();

    for (const dir of findComposerManifestDirs(root)) {
        if (claimedDirs.has(dir)) {
            continue;
        }

        const manifestPath = join(dir, "composer.json");
        let manifest: Record<string, unknown>;

        try {
            manifest = parseComposerJson(readFileSync(manifestPath, "utf8"));
        } catch (error) {
            throw invalid(manifestPath, `${manifestPath} is not a valid JSON object: ${(error as Error).message}.`);
        }

        if (manifest.name === undefined) {
            continue;
        }

        if (typeof manifest.name !== "string" || !COMPOSER_NAME.test(manifest.name) || !isValidPackageName(manifest.name)) {
            throw invalid(manifestPath, `${JSON.stringify(manifest.name)} is not a valid Composer name. Use lowercase "vendor/package", with segments of [a-z0-9] joined by "-", "." or "_".`);
        }

        const { name } = manifest;

        if (dir !== root) {
            throw invalid(manifestPath, `${name} is in a subdirectory. Packagist reads a package from its repository root, so its tag would never reach Packagist. Move it to its own repository, or remove its name.`);
        }

        if ("version" in manifest) {
            throw invalid(manifestPath, `${manifestPath} sets "version". Packagist ignores it and reads the version from the git tag. Remove the key; vis releases from the tag.`);
        }

        const existing = names.get(name);

        if (existing !== undefined) {
            throw invalid(manifestPath, `${name} is declared by both ${existing} and ${manifestPath}. A Composer name must be unique to release it.`);
        }

        names.set(name, manifestPath);
        found.push({ dir, manifest, manifestPath, name });
    }

    return Promise.all(
        found.map(async ({ dir, manifest, manifestPath, name }): Promise<ComposerProject> => {
            const version = (await latestComposerTag(runner, dir)) ?? "0.0.0";
            const dependencies: Record<string, string> = {};

            for (const required of requireKeys(manifest, "require")) {
                if (names.has(required) && required !== name) {
                    dependencies[required] = "*";
                }
            }

            return {
                name,
                package: {
                    dir,
                    ecosystem: "composer",
                    manifest: { dependencies, name, private: false, version },
                    manifestPath,
                    name,
                    private: false,
                    version,
                },
                perPackage: {
                    currentVersionResolver: "disk",
                    managed: true,
                    releaseTagPattern: "v{version}",
                    versionActions: "composer",
                },
            };
        }),
    );
};
