import { LockfilePruneError, type PruneInput, type PruneResult } from "./types";

interface NpmPackageEntry {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    link?: boolean;
    name?: string;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    resolved?: string;
    version?: string;
    workspaces?: string[];
    [key: string]: unknown;
}

interface NpmLockfile {
    dependencies?: Record<string, unknown>;
    lockfileVersion?: number;
    name?: string;
    packages?: Record<string, NpmPackageEntry>;
    requires?: boolean;
    [key: string]: unknown;
}

const POSIX_NODE_MODULES = "node_modules/";

/**
 * Walk up `node_modules` nesting to find the resolved entry for a dep
 * name from a starting package path. npm v3+ nests when a peer-dep
 * permutation forces a non-hoisted version: `packages/foo/node_modules/bar`
 * wins over `node_modules/bar` for `foo`'s `bar` import.
 */
const resolveDep = (packages: Record<string, NpmPackageEntry>, fromPath: string, depName: string): string | undefined => {
    let cursor = fromPath;

    while (true) {
        const candidate = cursor === "" ? `${POSIX_NODE_MODULES}${depName}` : `${cursor}/${POSIX_NODE_MODULES}${depName}`;

        if (packages[candidate] !== undefined) {
            return candidate;
        }

        if (cursor === "") {
            return undefined;
        }

        // Strip the deepest path segment (last `/...` or last `node_modules/...`)
        // to climb one nesting level. `packages/foo/node_modules/bar/node_modules/baz`
        // → `packages/foo/node_modules/bar` → `packages/foo`.
        const lastNm = cursor.lastIndexOf(`/${POSIX_NODE_MODULES.slice(0, -1)}/`);

        if (lastNm === -1) {
            cursor = "";
        } else {
            cursor = cursor.slice(0, lastNm);
        }
    }
};

const collectDepNames = (entry: NpmPackageEntry): string[] => {
    const names: string[] = [];

    for (const map of [entry.dependencies, entry.devDependencies, entry.optionalDependencies, entry.peerDependencies]) {
        if (!map) {
            continue;
        }

        for (const name of Object.keys(map)) {
            names.push(name);
        }
    }

    return names;
};

export const pruneNpmLockfile = (input: PruneInput): PruneResult => {
    const text = typeof input.lockfileContent === "string" ? input.lockfileContent : input.lockfileContent.toString("utf8");

    let parsed: NpmLockfile;

    try {
        parsed = JSON.parse(text) as NpmLockfile;
    } catch (error) {
        throw new LockfilePruneError(`package-lock.json: parse failed — ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== "object") {
        throw new LockfilePruneError("package-lock.json: top-level value is not an object");
    }

    const packages = parsed.packages ?? {};
    const closurePaths = new Set<string>([""]);

    for (const project of input.closure) {
        if (project.relativeRoot === "") {
            continue;
        }

        closurePaths.add(project.relativeRoot);
    }

    const keptKeys = new Set<string>();
    const queue: string[] = [];

    for (const key of Object.keys(packages)) {
        if (closurePaths.has(key)) {
            keptKeys.add(key);
            queue.push(key);
        }
    }

    // Workspace symlink entries (e.g. `node_modules/@my/foo` with `link: true`,
    // `resolved: "packages/foo"`) bridge name-based lookups to workspace
    // paths. Pull in any link whose resolved target is in the closure so
    // sibling workspace deps resolve correctly.
    for (const [key, entry] of Object.entries(packages)) {
        if (entry.link === true && typeof entry.resolved === "string" && closurePaths.has(entry.resolved)) {
            keptKeys.add(key);
        }
    }

    while (queue.length > 0) {
        const path = queue.shift()!;
        const entry = packages[path];

        if (!entry) {
            continue;
        }

        for (const depName of collectDepNames(entry)) {
            const resolvedKey = resolveDep(packages, path, depName);

            if (!resolvedKey || keptKeys.has(resolvedKey)) {
                continue;
            }

            keptKeys.add(resolvedKey);

            const target = packages[resolvedKey]!;

            // If the dep is itself a workspace link, fold its target's
            // path into the queue so we walk the linked workspace's deps.
            if (target.link === true && typeof target.resolved === "string" && packages[target.resolved] !== undefined && !keptKeys.has(target.resolved)) {
                keptKeys.add(target.resolved);
                queue.push(target.resolved);
            } else {
                queue.push(resolvedKey);
            }
        }
    }

    const prunedPackages: Record<string, NpmPackageEntry> = {};

    for (const key of Object.keys(packages)) {
        if (keptKeys.has(key)) {
            prunedPackages[key] = packages[key]!;
        }
    }

    const root = prunedPackages[""];

    // Trim the root entry's `workspaces` array so npm doesn't reject the
    // pruned context for referencing removed workspaces.
    if (root && Array.isArray(root.workspaces)) {
        root.workspaces = root.workspaces.filter((entry) => {
            if (typeof entry !== "string") {
                return false;
            }

            // Workspaces can be globs; we keep an entry if any closure path
            // starts with its prefix (cheap conservative check). The
            // installed deps are already pinned via `packages`, so over-
            // keeping a glob doesn't materialise extra installs.
            const prefix = entry.replace(/\/?\*+$/, "").replace(/\/$/, "");

            if (prefix === "" || prefix === "*") {
                return true;
            }

            for (const closurePath of closurePaths) {
                if (closurePath === entry || closurePath === prefix || closurePath.startsWith(`${prefix}/`)) {
                    return true;
                }
            }

            return false;
        });
    }

    const result: NpmLockfile = {
        ...parsed,
        packages: prunedPackages,
    };

    // Drop the legacy `dependencies` block (lockfileVersion 1 compat).
    // npm 7+ regenerates it on next install if needed; keeping the stale
    // copy after pruning would lie about the install set.
    delete result.dependencies;

    const originalCount = Object.keys(packages).length;
    const prunedCount = Object.keys(prunedPackages).length;
    const dropped = originalCount - prunedCount;

    return {
        content: `${JSON.stringify(result, null, 2)}\n`,
        message: `package-lock.json: kept ${prunedCount}/${originalCount} entries (dropped ${dropped})`,
        status: "pruned",
    };
};
