import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type { PruneInput, PruneResult } from "./types";
import { LockfilePruneError } from "./types";

interface PnpmImporter {
    dependencies?: Record<string, { specifier?: string; version: string }>;
    devDependencies?: Record<string, { specifier?: string; version: string }>;
    optionalDependencies?: Record<string, { specifier?: string; version: string }>;
}

interface PnpmPackageEntry {
    [key: string]: unknown;
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

interface PnpmLockfile {
    [key: string]: unknown;
    catalogs?: Record<string, unknown>;
    importers?: Record<string, PnpmImporter>;
    lockfileVersion?: number | string;
    overrides?: Record<string, string>;
    packages?: Record<string, PnpmPackageEntry>;
    patchedDependencies?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    /** v9 split — resolved dep tree per package + peer permutation. */
    snapshots?: Record<string, PnpmPackageEntry>;
}

/**
 * Strip the leading `/` (v6) and any peer-dep tail `(react@18.0.0)` from
 * a pnpm package key so we can compare keys across `packages` and
 * `snapshots` and across v6/v9 lockfiles. The pruner walks resolved peer
 * permutations separately, so the canonical form is just `name@version`.
 */
const canonicalKey = (key: string): string => {
    let result = key.startsWith("/") ? key.slice(1) : key;
    const parenIndex = result.indexOf("(");

    if (parenIndex !== -1) {
        result = result.slice(0, parenIndex);
    }

    return result;
};

/**
 * In pnpm v9, dep version specs are bare versions (`1.2.3`,
 * `1.2.3(react@18.0.0)`). Workspace links use `link:../foo`. We don't
 * need to follow `link:` here — closure projects are passed in
 * separately and their importers are kept independently.
 */
const resolveDepKey = (depName: string, depVersion: string): string | undefined => {
    if (depVersion.startsWith("link:") || depVersion.startsWith("file:") || depVersion.startsWith("workspace:")) {
        return undefined;
    }

    return `${depName}@${depVersion}`;
};

const collectImporterDeps = (importer: PnpmImporter): { name: string; version: string }[] => {
    const result: { name: string; version: string }[] = [];

    for (const map of [importer.dependencies, importer.devDependencies, importer.optionalDependencies]) {
        if (!map) {
            continue;
        }

        for (const [name, entry] of Object.entries(map)) {
            if (!entry?.version) {
                continue;
            }

            result.push({ name, version: entry.version });
        }
    }

    return result;
};

const collectPackageDeps = (entry: PnpmPackageEntry): { name: string; version: string }[] => {
    const result: { name: string; version: string }[] = [];

    for (const map of [entry.dependencies, entry.optionalDependencies]) {
        if (!map) {
            continue;
        }

        for (const [name, version] of Object.entries(map)) {
            if (typeof version !== "string") {
                continue;
            }

            result.push({ name, version });
        }
    }

    return result;
};

/**
 * Build a lookup that, given a canonical `name@version`, returns every
 * lockfile key (raw, possibly with peer-dep suffix or leading slash)
 * that resolves to it. Same canonical can have multiple keys when the
 * package is installed against different peer-dep permutations — we
 * keep all of them.
 */
const buildKeyIndex = (entries: Record<string, PnpmPackageEntry> | undefined): Map<string, string[]> => {
    const index = new Map<string, string[]>();

    if (!entries) {
        return index;
    }

    for (const key of Object.keys(entries)) {
        const canonical = canonicalKey(key);
        const list = index.get(canonical);

        if (list) {
            list.push(key);
        } else {
            index.set(canonical, [key]);
        }
    }

    return index;
};

export const prunePnpmLockfile = (input: PruneInput): PruneResult => {
    const text = typeof input.lockfileContent === "string" ? input.lockfileContent : input.lockfileContent.toString("utf8");

    let parsed: PnpmLockfile;

    try {
        parsed = parseYaml(text) as PnpmLockfile;
    } catch (error) {
        throw new LockfilePruneError(`pnpm-lock.yaml: parse failed — ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== "object") {
        throw new LockfilePruneError("pnpm-lock.yaml: top-level value is not an object");
    }

    const importers = parsed.importers ?? {};
    const packagesIndex = buildKeyIndex(parsed.packages);
    const snapshotsIndex = buildKeyIndex(parsed.snapshots);

    // 1. Filter importers: keep `.` (root, always) plus the focus closure.
    const closureRoots = new Set<string>(["."]);

    for (const project of input.closure) {
        // pnpm uses POSIX paths and `.` for the workspace root.
        closureRoots.add(project.relativeRoot === "" ? "." : project.relativeRoot);
    }

    const keptImporters: Record<string, PnpmImporter> = {};

    for (const [path, importer] of Object.entries(importers)) {
        if (closureRoots.has(path)) {
            keptImporters[path] = importer;
        }
    }

    // 2. BFS from kept importers' deps over the snapshots/packages graph.
    const keptPackageKeys = new Set<string>();
    const keptSnapshotKeys = new Set<string>();
    const queue: { name: string; version: string }[] = [];

    for (const importer of Object.values(keptImporters)) {
        for (const dep of collectImporterDeps(importer)) {
            queue.push(dep);
        }
    }

    while (queue.length > 0) {
        const { name, version } = queue.shift()!;
        const depKey = resolveDepKey(name, version);

        if (!depKey) {
            continue;
        }

        const canonical = canonicalKey(depKey);

        // Snapshots carry the resolved dep edges (v9). Walk those first.
        const snapshotKeys = snapshotsIndex.get(canonical) ?? snapshotsIndex.get(depKey) ?? [];

        for (const key of snapshotKeys) {
            if (keptSnapshotKeys.has(key)) {
                continue;
            }

            keptSnapshotKeys.add(key);

            const snapshot = parsed.snapshots?.[key];

            if (snapshot) {
                for (const dep of collectPackageDeps(snapshot)) {
                    queue.push(dep);
                }
            }
        }

        // Packages carry metadata (resolution, integrity, engines) and
        // also dep edges in v6. Track and walk for both versions.
        const packageKeys = packagesIndex.get(canonical) ?? packagesIndex.get(depKey) ?? [];

        for (const key of packageKeys) {
            if (keptPackageKeys.has(key)) {
                continue;
            }

            keptPackageKeys.add(key);

            const packageEntry = parsed.packages?.[key];

            // v6 packages also carry deps; v9 packages don't (deps moved to snapshots).
            if (packageEntry && !parsed.snapshots) {
                for (const dep of collectPackageDeps(packageEntry)) {
                    queue.push(dep);
                }
            }
        }
    }

    // 3. Build the pruned lockfile object preserving structural keys.
    const result: PnpmLockfile = {
        lockfileVersion: parsed.lockfileVersion,
    };

    for (const key of ["settings", "overrides", "patchedDependencies", "catalogs"] as const) {
        if (parsed[key] !== undefined) {
            (result as Record<string, unknown>)[key] = parsed[key];
        }
    }

    result.importers = keptImporters;

    if (parsed.packages) {
        const prunedPackages: Record<string, PnpmPackageEntry> = {};

        for (const key of Object.keys(parsed.packages)) {
            if (keptPackageKeys.has(key)) {
                prunedPackages[key] = parsed.packages[key]!;
            }
        }

        result.packages = prunedPackages;
    }

    if (parsed.snapshots) {
        const prunedSnapshots: Record<string, PnpmPackageEntry> = {};

        for (const key of Object.keys(parsed.snapshots)) {
            if (keptSnapshotKeys.has(key)) {
                prunedSnapshots[key] = parsed.snapshots[key]!;
            }
        }

        result.snapshots = prunedSnapshots;
    }

    const originalPackageCount = Object.keys(parsed.packages ?? {}).length;
    const prunedPackageCount = Object.keys(result.packages ?? {}).length;
    const droppedPackages = originalPackageCount - prunedPackageCount;
    const droppedImporters = Object.keys(importers).length - Object.keys(keptImporters).length;

    return {
        content: stringifyYaml(result, { lineWidth: 0 }),
        message: `pnpm-lock.yaml: kept ${prunedPackageCount}/${originalPackageCount} packages and ${Object.keys(keptImporters).length} importers (dropped ${droppedPackages} packages, ${droppedImporters} importers)`,
        status: "pruned",
    };
};
