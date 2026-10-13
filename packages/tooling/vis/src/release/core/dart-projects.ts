/**
 * Dart packages as release packages, opt-in through `release.dart.discover`.
 *
 * The root `pubspec.yaml` is a package when it sets its own version. Under a pub
 * workspace (`workspace:` list, globs of `dir/*` only) each listed member with a
 * `pubspec.yaml` is one too. A pubspec with no `version:`, or with `publish_to: none`,
 * is not released. The name is the pubspec's `name:` and the version is its
 * `version:` literal, read from the pubspec that owns it. Anything else is an error.
 *
 * Workspace members depend on each other by name, so a dependency key that names a
 * released package orders the publish ("*"). The version is not rewritten there.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { DartPubspecError, expandDartWorkspaceEntry, scanDartPubspec } from "../../util/dart-pubspec";
import { VisReleaseError } from "../errors";
import type { PackageManifest, WorkspacePackage } from "../types";
import { isValidPackageName } from "./security";

/** One Dart package as the release wave sees it. */
export interface DartProject {
    name: string;
    /** The `pubspec.yaml` holding the version literal this package's release rewrites. */
    owner: string;
    package: WorkspacePackage;
}

const PUB_DEV = "https://pub.dev";

const invalid = (file: string, message: string): VisReleaseError => new VisReleaseError({ code: "CONFIG_INVALID", file, message });

/**
 * Discover the Dart packages under `cwd`. Returns nothing without a root
 * `pubspec.yaml`. `options.claimedDirs` are package directories a JS package already
 * releases; they are skipped.
 */
export const discoverDartProjects = (options: { claimedDirs: ReadonlySet<string>; cwd: string }): DartProject[] => {
    const { claimedDirs, cwd } = options;
    const rootOwner = join(cwd, "pubspec.yaml");

    if (!existsSync(rootOwner)) {
        return [];
    }

    const rootScan = readScan(rootOwner);
    const directories = [cwd];

    if (rootScan.workspace !== undefined) {
        for (const entry of rootScan.workspace) {
            const isPattern = entry.includes("*");

            if (!isPattern && !existsSync(join(cwd, entry, "pubspec.yaml"))) {
                throw invalid(rootOwner, `${rootOwner} lists "${entry}" in workspace, but that directory has no pubspec.yaml.`);
            }

            let expanded: string[];

            try {
                expanded = expandDartWorkspaceEntry(cwd, entry);
            } catch (error) {
                if (error instanceof DartPubspecError) {
                    throw invalid(rootOwner, `${rootOwner}: ${error.message}.`);
                }

                throw error;
            }

            directories.push(...expanded.map((dir) => resolve(dir)));
        }
    }

    const found: { dependencyNames: string[]; dir: string; name: string; owner: string; version: string }[] = [];

    for (const dir of new Set(directories.map((directory) => resolve(directory)))) {
        const owner = join(dir, "pubspec.yaml");
        const scan = readScan(owner);

        // A root that holds only the workspace list has nothing to publish; `publish_to: none` opts out explicitly.
        if (scan.publishTo === "none" || scan.version === undefined || claimedDirs.has(dir)) {
            continue;
        }

        if (scan.publishTo !== undefined && scan.publishTo !== PUB_DEV) {
            throw invalid(
                owner,
                `${owner} sets publish_to to "${scan.publishTo}". vis checks and publishes only to ${PUB_DEV}; remove publish_to or release the package with a shell publish.`,
            );
        }

        if (scan.name === undefined) {
            throw invalid(owner, `${owner} sets version but has no name. Declare name: your_package in it.`);
        }

        if (!isValidPackageName(scan.name)) {
            throw invalid(owner, `${owner} names the package "${scan.name}", which is not a valid release name.`);
        }

        found.push({ dependencyNames: scan.dependencyNames, dir, name: scan.name, owner, version: scan.version.value });
    }

    const names = new Map<string, string>();

    for (const entry of found) {
        const existing = names.get(entry.name);

        if (existing !== undefined) {
            throw invalid(entry.owner, `${entry.name} is declared by both ${existing} and ${entry.owner}. Package names must be unique to release them.`);
        }

        names.set(entry.name, entry.owner);
    }

    return found.map((entry) => {
        // Only dependencies on released packages count. A dependency with no version to move is "*".
        const dependencies: Record<string, string> = {};

        for (const dependency of entry.dependencyNames) {
            if (names.has(dependency) && dependency !== entry.name) {
                dependencies[dependency] = "*";
            }
        }

        const manifest: PackageManifest = { dependencies, name: entry.name, private: false, version: entry.version };

        return {
            name: entry.name,
            owner: entry.owner,
            package: {
                dir: entry.dir,
                ecosystem: "dart",
                manifest,
                manifestPath: entry.owner,
                name: entry.name,
                private: false,
                version: entry.version,
            },
        };
    });
};

const readScan = (owner: string): ReturnType<typeof scanDartPubspec> => {
    try {
        return scanDartPubspec(readFileSync(owner, "utf8"));
    } catch (error) {
        if (error instanceof DartPubspecError) {
            throw invalid(owner, `${owner}: ${error.message}.`);
        }

        throw error;
    }
};
