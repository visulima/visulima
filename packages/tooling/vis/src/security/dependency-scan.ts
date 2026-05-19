/**
 * Shared dependency-scan helpers used by `audit`, `optimize`, and `doctor`.
 *
 * Lives here (not under any single command) so multiple lazy commands can
 * import these utilities without coupling their handler chunks together.
 */

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import type { LockFileEntry, LockFileType } from "@visulima/package";
import { parseLockFileContent } from "@visulima/package";
import { join } from "@visulima/path";

import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../config/workspace";

export interface InstalledPackage {
    isDev: boolean;
    name: string;
    version: string;
}

/** A package installed in multiple versions. */
export interface DuplicatePackage {
    /** The package name. */
    name: string;
    /** Each installed version. */
    versions: string[];
}

export const LOCKFILE_NAMES: Record<string, { aliases?: ReadonlyArray<string>; file: string; type: LockFileType }> = {
    bun: { file: "bun.lock", type: "bun" },
    // `npm-shrinkwrap.json` is npm's published, authoritative lockfile and
    // takes precedence over `package-lock.json` whenever both are present
    // (https://docs.npmjs.com/cli/configuring-npm/npm-shrinkwrap-json). It's
    // also the file that actually ships with a package, so it's the
    // security-relevant one to scan.
    // `aliases` MUST share the canonical file's `type` — `lockfileCandidates`
    // binds every candidate to `info.type`, and `detectLockfileType` relies on
    // that to stay correct regardless of alias-vs-canonical iteration order.
    npm: { aliases: ["npm-shrinkwrap.json"], file: "package-lock.json", type: "npm" },
    pnpm: { file: "pnpm-lock.yaml", type: "pnpm" },
    yarn: { file: "yarn.lock", type: "yarn" },
};

/**
 * Precedence-ordered candidate lockfiles for a package manager. Aliases
 * rank above the canonical file, so for npm this yields
 * `npm-shrinkwrap.json` before `package-lock.json`.
 */
const lockfileCandidates = (pmName: string): { file: string; type: LockFileType }[] => {
    const info = LOCKFILE_NAMES[pmName];

    if (!info) {
        return [];
    }

    return [...(info.aliases ?? []), info.file].map((file) => {
        return { file, type: info.type };
    });
};

/**
 * Resolves the lockfile vis should actually read for `pmName` under
 * `workspaceRoot`, honouring npm's shrinkwrap precedence. When none of
 * the candidates exist, the canonical entry is returned so callers keep
 * their existing missing-file handling.
 */
export const resolveLockfile = (workspaceRoot: string, pmName: string): { file: string; type: LockFileType } | undefined => {
    const candidates = lockfileCandidates(pmName);

    if (candidates.length === 0) {
        return undefined;
    }

    return candidates.find((candidate) => isAccessibleSync(join(workspaceRoot, candidate.file))) ?? candidates[candidates.length - 1];
};

/**
 * Resolved `name@version` pairs from the workspace lockfile.
 *
 * Replaces a recursive `node_modules` walk for callers that only need
 * the set of installed packages to query against (OSV vulnerabilities,
 * Socket.dev reports, etc.). On a 44-package monorepo this is a single
 * lockfile parse (~80ms) versus thousands of `readdir`/`stat` calls.
 *
 * Entries are deduplicated by `name@version` — the lockfile lists each
 * resolution once per dependency edge, but vulnerability scans only
 * care about the unique versions actually installed.
 *
 * `isDev` is set to `false` for every entry: lockfiles don't mark
 * transitive dev/prod and no current consumer reads the flag. If a
 * caller starts to depend on it, derive it from `package.json`.
 */
export interface LockedPackagesOptions {
    /** When false, devDependencies (and dev-only transitives) are filtered out. Default: true. */
    includeDev?: boolean;
}

interface PackageJsonShape {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name?: string;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    workspaces?: string[] | { packages?: string[] };
}

const readPackageJsonShape = (path: string): PackageJsonShape | undefined => {
    try {
        return JSON.parse(readFileSync(path)) as PackageJsonShape;
    } catch {
        return undefined;
    }
};

const collectWorkspacePackageJsons = (workspaceRoot: string): PackageJsonShape[] => {
    const result: PackageJsonShape[] = [];
    const root = readPackageJsonShape(join(workspaceRoot, "package.json"));

    if (root) {
        result.push(root);
    }

    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);
    let patterns: string[] | undefined;

    if (pnpmPatterns) {
        patterns = pnpmPatterns;
    } else if (root?.workspaces) {
        if (Array.isArray(root.workspaces)) {
            patterns = root.workspaces;
        } else if (root.workspaces.packages) {
            patterns = root.workspaces.packages;
        }
    }

    if (!patterns) {
        return result;
    }

    const directories = resolveWorkspacePatterns(workspaceRoot, patterns);

    for (const directory of directories) {
        const pkg = readPackageJsonShape(join(workspaceRoot, directory, "package.json"));

        if (pkg) {
            result.push(pkg);
        }
    }

    return result;
};

/**
 * Build the set of package names reachable from the workspace's PROD roots.
 *
 * Reachability walks `dependencies`, `peerDependencies`, and `optionalDependencies`
 * — never `devDependencies` (a transitive can't be marked dev at the lockfile
 * level, only at a direct-root package.json). Workspace packages count as
 * roots so monorepo-internal prod paths stay reachable.
 *
 * `entries` is the parsed lockfile so callers can reuse a single parse.
 */
const computeProdReachable = (workspaceRoot: string, entries: LockFileEntry[]): Set<string> => {
    const reachable = new Set<string>();
    const queue: string[] = [];

    // Index lockfile entries by name. With pnpm v9+ peer-context variants
    // a name can map to multiple entries (each with its own dependencies
    // map). For prod-reachability we union dependencies across all variants
    // — they all represent the same package.
    const entriesByName = new Map<string, LockFileEntry[]>();

    for (const entry of entries) {
        const list = entriesByName.get(entry.name);

        if (list) {
            list.push(entry);
        } else {
            entriesByName.set(entry.name, [entry]);
        }
    }

    const enqueueRoots = (deps: Record<string, string> | undefined): void => {
        if (!deps) {
            return;
        }

        for (const name of Object.keys(deps)) {
            if (!reachable.has(name)) {
                reachable.add(name);
                queue.push(name);
            }
        }
    };

    for (const pkg of collectWorkspacePackageJsons(workspaceRoot)) {
        enqueueRoots(pkg.dependencies);
        enqueueRoots(pkg.peerDependencies);
        enqueueRoots(pkg.optionalDependencies);
    }

    while (queue.length > 0) {
        const name = queue.shift()!;
        const variants = entriesByName.get(name);

        if (!variants) {
            continue;
        }

        for (const variant of variants) {
            for (const map of [variant.dependencies, variant.peerDependencies, variant.optionalDependencies]) {
                if (!map) {
                    continue;
                }

                for (const childName of Object.keys(map)) {
                    if (!reachable.has(childName)) {
                        reachable.add(childName);
                        queue.push(childName);
                    }
                }
            }
        }
    }

    return reachable;
};

export const lockedPackages = (workspaceRoot: string, pmName: string, options: LockedPackagesOptions = {}): InstalledPackage[] => {
    const lockInfo = resolveLockfile(workspaceRoot, pmName);

    if (!lockInfo) {
        return [];
    }

    let lockContent: string;

    try {
        lockContent = readFileSync(join(workspaceRoot, lockInfo.file));
    } catch {
        return [];
    }

    const entries = parseLockFileContent(lockContent, lockInfo.type);

    if (entries.length === 0) {
        return [];
    }

    const includeDev = options.includeDev ?? true;
    const prodReachable = includeDev ? undefined : computeProdReachable(workspaceRoot, entries);

    const seen = new Set<string>();
    const packages: InstalledPackage[] = [];

    for (const entry of entries) {
        if (prodReachable && !prodReachable.has(entry.name)) {
            continue;
        }

        const key = `${entry.name}@${entry.version}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        packages.push({ isDev: false, name: entry.name, version: entry.version });
    }

    return packages;
};

/**
 * Finds packages with multiple installed versions by parsing the
 * workspace lockfile via `@visulima/package`.
 */
export const findDuplicateDependencies = (workspaceRoot: string, pmName: string): DuplicatePackage[] => {
    const lockInfo = resolveLockfile(workspaceRoot, pmName);

    if (!lockInfo) {
        return [];
    }

    let lockContent: string;

    try {
        lockContent = readFileSync(join(workspaceRoot, lockInfo.file));
    } catch {
        return [];
    }

    const entries = parseLockFileContent(lockContent, lockInfo.type);

    if (entries.length === 0) {
        return [];
    }

    const versionMap = new Map<string, Set<string>>();

    for (const entry of entries) {
        if (!versionMap.has(entry.name)) {
            versionMap.set(entry.name, new Set());
        }

        versionMap.get(entry.name)!.add(entry.version);
    }

    const duplicates: DuplicatePackage[] = [];

    for (const [name, versions] of versionMap) {
        if (versions.size <= 1) {
            continue;
        }

        duplicates.push({ name, versions: [...versions] });
    }

    return duplicates.sort((a, b) => a.name.localeCompare(b.name));
};
