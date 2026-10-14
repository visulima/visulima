/**
 * Swift packages as release packages, opt-in through `release.swift.discover`.
 *
 * Every directory under the workspace root with a `Package.swift` becomes a
 * `WorkspacePackage` with `ecosystem: "swift"`. The name is the string literal in
 * `Package(name: "…")`; a name that is not a literal, or not a valid release name
 * (lowercase letters, digits, `.`, `_`, `-`), is an error.
 *
 * SwiftPM has no version field. It resolves versions from Git tags, so the version
 * comes from the tags (`currentVersionResolver: "git-tag"`), and the release
 * creates the tag. The manifest version is a placeholder used until a tag exists.
 * Release a package from a tag you set by hand (for example `1.0.0`) to set the
 * baseline. Otherwise the first release bumps from the placeholder.
 *
 * A `.package(path: "…")` dependency on another discovered package orders the
 * release. It carries no version, so nothing is rewritten.
 */

import { readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import { findSwiftPackageDirectories, readSwiftPackageName, readSwiftPathDependencies, SWIFT_MANIFEST } from "../../util/swift-package";
import { VisReleaseError } from "../errors";
import type { PackageManifest, WorkspacePackage } from "../types";
import { isValidPackageName } from "./security";

/** The version a Swift package carries before any tag exists. The git-tag resolver replaces it. */
export const SWIFT_PLACEHOLDER_VERSION = "0.0.0";

export interface SwiftProject {
    package: WorkspacePackage;
}

const invalid = (file: string, message: string): VisReleaseError => new VisReleaseError({ code: "CONFIG_INVALID", file, message });

/**
 * Discover the Swift packages under `cwd`. `options.claimedDirs` are package
 * directories a JS package already releases; they are skipped.
 */
export const discoverSwiftProjects = async (options: { claimedDirs: ReadonlySet<string>; cwd: string }): Promise<SwiftProject[]> => {
    const { claimedDirs, cwd } = options;

    const entries: { dir: string; manifestPath: string; name: string; paths: string[] }[] = [];

    for (const dir of findSwiftPackageDirectories(resolve(cwd))) {
        if ([...claimedDirs].some((claimed) => dir === claimed || dir.startsWith(`${claimed}${sep}`))) {
            continue;
        }

        const manifestPath = join(dir, SWIFT_MANIFEST);
        const text = readFileSync(manifestPath, "utf8");
        const declared = readSwiftPackageName(text);

        if (declared.kind === "missing") {
            throw invalid(manifestPath, `${manifestPath} has no Package(name: "…") string literal. vis reads the release name from it.`);
        }

        if (declared.kind === "dynamic") {
            throw invalid(manifestPath, `${manifestPath} sets the package name to an expression. vis reads only a plain string literal, such as Package(name: "my-lib").`);
        }

        if (!isValidPackageName(declared.name)) {
            throw invalid(
                manifestPath,
                `${manifestPath} names the package ${JSON.stringify(declared.name)}. A release name uses lowercase letters, digits, '.', '_' and '-' only.`,
            );
        }

        const pathDependencies = readSwiftPathDependencies(text);

        if (pathDependencies.dynamic) {
            throw invalid(manifestPath, `${manifestPath} has a .package(path:) dependency that is not a string literal. vis cannot follow it.`);
        }

        entries.push({ dir, manifestPath, name: declared.name, paths: pathDependencies.paths.map((path) => resolve(dir, path)) });
    }

    const names = new Map<string, string>();

    for (const entry of entries) {
        const existing = names.get(entry.name);

        if (existing !== undefined) {
            throw invalid(entry.manifestPath, `${entry.name} is declared by both ${existing} and ${entry.manifestPath}. Release names must be unique.`);
        }

        names.set(entry.name, entry.manifestPath);
    }

    // Only edges to discovered packages count; a path to an unclaimed-or-missing package has nothing to order.
    const byDir = new Map(entries.map((entry) => [entry.dir, entry.name]));

    return entries.map((entry) => {
        const dependencies: Record<string, string> = {};

        for (const target of entry.paths) {
            const dependency = byDir.get(target);

            if (dependency !== undefined && dependency !== entry.name) {
                dependencies[dependency] = "*";
            }
        }

        const manifest: PackageManifest = { dependencies, name: entry.name, private: false, version: SWIFT_PLACEHOLDER_VERSION };

        return {
            package: {
                dir: entry.dir,
                ecosystem: "swift",
                manifest,
                manifestPath: entry.manifestPath,
                name: entry.name,
                private: false,
                version: SWIFT_PLACEHOLDER_VERSION,
            },
        };
    });
};
