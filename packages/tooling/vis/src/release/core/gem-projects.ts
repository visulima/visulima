/**
 * Gems as release packages, opt-in through `release.gem.discover`.
 *
 * Every `*.gemspec` under the root (except in `vendor`, `node_modules` and `.bundle`)
 * is a `WorkspacePackage` with `ecosystem: "gem"`, named by its `spec.name` literal.
 * One gemspec per directory: a second one there is an error, because `gem build` needs
 * to know which gemspec it builds.
 *
 * The version is a string literal in the gemspec, or `Name::VERSION` with the literal
 * in `lib/&lt;name>/version.rb`. Anything else is an error, not a silent skip. A gemspec
 * with no version at all is an aggregate and is skipped.
 */

import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

import { findGemspecs, GemspecReadError, gemVersionFile, parseGemspec, readGemVersionConstant } from "../../util/gemspec";
import { VisReleaseError } from "../errors";
import type { PackageManifest, WorkspacePackage } from "../types";
import { isValidPackageName } from "./security";

/** One gem as the release wave sees it. */
export interface GemProject {
    /** `literal`: the gemspec sets the version. `constant`: `Name::VERSION` in a version file. */
    kind: "constant" | "literal";
    /** 1-based line of the version declaration in `owner`. The plan finds it again by line after earlier writes. */
    line: number;
    name: string;
    /** The file holding the version literal this gem's release rewrites: its gemspec, or its version.rb. */
    owner: string;
    package: WorkspacePackage;
}

const invalid = (file: string, message: string, packageName?: string): VisReleaseError =>
    new VisReleaseError({ code: "CONFIG_INVALID", file, message, packageName });

/**
 * Discover the gems under `cwd`. `options.claimedDirs` are directories a JS package
 * already releases; they are skipped. Returns nothing when there is no gemspec.
 */
export const discoverGemProjects = async (options: { claimedDirs: ReadonlySet<string>; cwd: string }): Promise<GemProject[]> => {
    const { claimedDirs, cwd } = options;
    const found: GemProject[] = [];
    const dependencyNames = new Map<GemProject, string[]>();
    const directories = new Set<string>();

    for (const path of findGemspecs(cwd)) {
        const dir = dirname(path);

        if (directories.has(dir)) {
            throw invalid(path, `${dir} holds more than one gemspec. vis builds one gem per directory; move one of them to its own directory.`);
        }

        directories.add(dir);

        if (claimedDirs.has(dir)) {
            continue;
        }

        let info: ReturnType<typeof parseGemspec>;

        try {
            info = parseGemspec(await readFile(path, "utf8"), path);
        } catch (error) {
            if (error instanceof GemspecReadError) {
                throw invalid(error.file, error.message);
            }

            throw error;
        }

        // No version at all: an aggregate, with nothing to release.
        if (info.version === undefined) {
            continue;
        }

        if (info.name === undefined) {
            throw invalid(path, `${path} sets a version but no name. Declare spec.name = "my-gem" in the gemspec.`);
        }

        const name = info.name.value;

        if (!isValidPackageName(name)) {
            throw invalid(path, `${path} names the gem "${name}", which is not a valid package name (lowercase letters, digits, ".", "_" and "-").`, name);
        }

        let owner = path;
        let line: number;
        let version: string;

        if (info.version.kind === "literal") {
            line = info.version.line;
            version = info.version.value;
        } else {
            const versionFile = gemVersionFile(dir, name);
            let raw: string;

            try {
                raw = await readFile(versionFile, "utf8");
            } catch {
                throw invalid(
                    path,
                    `${path} sets spec.version to ${info.version.constant}, but ${versionFile} does not exist. Put VERSION = "1.0.0" in that file, or set spec.version to a string literal.`,
                    name,
                );
            }

            try {
                const constant = readGemVersionConstant(raw, versionFile);

                owner = versionFile;
                line = constant.line;
                version = constant.value;
            } catch (error) {
                if (error instanceof GemspecReadError) {
                    throw invalid(error.file, error.message, name);
                }

                throw error;
            }
        }

        const entry: GemProject = {
            kind: info.version.kind,
            line,
            name,
            owner,
            package: {
                dir,
                ecosystem: "gem",
                manifest: { dependencies: {}, name, private: false, version },
                manifestPath: path,
                name,
                private: false,
                version,
            },
        };

        found.push(entry);
        dependencyNames.set(entry, info.dependencies);
    }

    const names = new Map<string, string>();

    for (const entry of found) {
        const existing = names.get(entry.name);

        if (existing !== undefined) {
            throw invalid(entry.package.manifestPath, `${entry.name} is declared by both ${existing} and ${entry.package.manifestPath}. Gem names must be unique to release them.`, entry.name);
        }

        names.set(entry.name, entry.package.manifestPath);
    }

    // A runtime dependency on another discovered gem orders the publish. It has no version to move, so it is "*".
    const gemNames = new Set(found.map((entry) => entry.name));

    return found.map((entry) => {
        const dependencies: Record<string, string> = {};

        for (const dependency of dependencyNames.get(entry) ?? []) {
            if (gemNames.has(dependency) && dependency !== entry.name) {
                dependencies[dependency] = "*";
            }
        }

        const manifest: PackageManifest = { ...entry.package.manifest, dependencies };

        return { ...entry, package: { ...entry.package, manifest } };
    });
};
