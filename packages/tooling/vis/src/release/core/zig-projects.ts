/**
 * Zig packages as release packages, opt-in through `release.zig.discover`.
 *
 * The workspace root's `build.zig.zon` and every `.path` dependency that holds its
 * own `build.zig.zon` and stays inside the workspace become `WorkspacePackage`s with
 * `ecosystem: "zig"`. The name is the manifest's `.name`, which must be a lowercase
 * package name vis can publish. The version is the manifest's `.version` string
 * literal. Anything else is an error, not a silent skip. A manifest with no
 * `.version` is an aggregate and is not released; the root is released only with a
 * version of its own.
 */

import { resolve } from "node:path";

import { readIfExists, walkZigManifests, ZigManifestError } from "../../util/zig-manifest";
import { VisReleaseError } from "../errors";
import type { PackageManifest, WorkspacePackage } from "../types";
import { isValidPackageName } from "./security";

/** One Zig package as the release wave sees it. */
export interface ZigProject {
    name: string;
    /** The `build.zig.zon` holding the version literal this package's release rewrites. */
    owner: string;
    package: WorkspacePackage;
}

const invalid = (file: string, message: string): VisReleaseError => new VisReleaseError({ code: "CONFIG_INVALID", file, message });

/**
 * Discover the Zig packages under `cwd`. Returns nothing without a root
 * `build.zig.zon`. `options.claimedDirs` are package directories a JS package
 * already releases; they are skipped, but their dependencies are still followed.
 */
export const discoverZigProjects = async (options: { claimedDirs: ReadonlySet<string>; cwd: string }): Promise<ZigProject[]> => {
    const { claimedDirs, cwd } = options;

    let nodes: ReturnType<typeof walkZigManifests>;

    try {
        nodes = walkZigManifests(cwd, cwd, readIfExists);
    } catch (error) {
        if (error instanceof ZigManifestError) {
            throw invalid(error.file, error.message);
        }

        throw error;
    }

    const found: { dependencies: string[]; dir: string; name: string; owner: string; version: string }[] = [];

    for (const node of nodes) {
        const { manifest } = node;

        // An aggregate (no version anywhere in the manifest) has nothing to publish.
        if (manifest.version === undefined || claimedDirs.has(resolve(node.dir))) {
            continue;
        }

        if (manifest.name === undefined) {
            throw invalid(node.path, `${node.path} sets .version but has no .name. Declare .name = .your_package in it.`);
        }

        if (!isValidPackageName(manifest.name.value)) {
            throw invalid(
                node.path,
                `${node.path} names the package "${manifest.name.value}", which is not a valid release name. Use lowercase letters, digits, ".", "_" or "-" in .name (line ${String(manifest.name.line)}).`,
            );
        }

        found.push({
            dependencies: manifest.pathDependencies.map((dependency) => resolve(node.dir, dependency)),
            dir: node.dir,
            name: manifest.name.value,
            owner: node.path,
            version: manifest.version.value,
        });
    }

    const names = new Map<string, string>();

    for (const entry of found) {
        const existing = names.get(entry.name);

        if (existing !== undefined) {
            throw invalid(entry.owner, `${entry.name} is declared by both ${existing} and ${entry.owner}. Package names must be unique to release them.`);
        }

        names.set(entry.name, entry.owner);
    }

    // Only edges to released packages count. A path dependency with no version to move is "*".
    const nameByDir = new Map(found.map((entry) => [entry.dir, entry.name]));

    return found.map((entry) => {
        const dependencies: Record<string, string> = {};

        for (const target of entry.dependencies) {
            const name = nameByDir.get(target);

            if (name !== undefined && name !== entry.name) {
                dependencies[name] = "*";
            }
        }

        const manifest: PackageManifest = { dependencies, name: entry.name, private: false, version: entry.version };

        return {
            name: entry.name,
            owner: entry.owner,
            package: {
                dir: entry.dir,
                ecosystem: "zig",
                manifest,
                manifestPath: entry.owner,
                name: entry.name,
                private: false,
                version: entry.version,
            },
        };
    });
};
