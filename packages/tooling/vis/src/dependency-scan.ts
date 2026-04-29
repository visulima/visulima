/**
 * Shared dependency-scan helpers used by `audit`, `optimize`, and `doctor`.
 *
 * Lives here (not under any single command) so multiple lazy commands can
 * import these utilities without coupling their handler chunks together.
 */

import { readFileSync } from "@visulima/fs";
import type { LockFileType } from "@visulima/package";
import { parseLockFileContent } from "@visulima/package";
import { join } from "@visulima/path";

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

const LOCKFILE_NAMES: Record<string, { file: string; type: LockFileType }> = {
    bun: { file: "bun.lock", type: "bun" },
    npm: { file: "package-lock.json", type: "npm" },
    pnpm: { file: "pnpm-lock.yaml", type: "pnpm" },
    yarn: { file: "yarn.lock", type: "yarn" },
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
export const lockedPackages = (workspaceRoot: string, pmName: string): InstalledPackage[] => {
    const lockInfo = LOCKFILE_NAMES[pmName];

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

    const seen = new Set<string>();
    const packages: InstalledPackage[] = [];

    for (const entry of entries) {
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
    const lockInfo = LOCKFILE_NAMES[pmName];

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
