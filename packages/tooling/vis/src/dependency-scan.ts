/**
 * Shared dependency-scan helpers used by `audit`, `optimize`, and `doctor`.
 *
 * Lives here (not under any single command) so multiple lazy commands can
 * import these utilities without coupling their handler chunks together.
 */

import { readdirSync, statSync } from "node:fs";

import { isAccessibleSync, readFileSync, readJsonSync } from "@visulima/fs";
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

export const scanInstalledPackages = (workspaceRoot: string): InstalledPackage[] => {
    const nodeModulesPath = join(workspaceRoot, "node_modules");

    if (!isAccessibleSync(nodeModulesPath)) {
        return [];
    }

    const packages: InstalledPackage[] = [];

    const rootPkgPath = join(workspaceRoot, "package.json");
    let devDeps = new Set<string>();

    if (isAccessibleSync(rootPkgPath)) {
        try {
            const pkg = readJsonSync(rootPkgPath) as {
                devDependencies?: Record<string, string>;
            };

            devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));
        } catch {
            // Non-critical
        }
    }

    const scanDir = (dir: string, prefix: string): void => {
        let entries: string[];

        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }

        for (const entry of entries) {
            if (entry.startsWith(".")) {
                continue;
            }

            const fullPath = join(dir, entry);

            if (entry.startsWith("@")) {
                scanDir(fullPath, `${entry}/`);
                continue;
            }

            const pkgName = prefix + entry;
            const pkgJsonPath = join(fullPath, "package.json");

            try {
                if (!statSync(fullPath).isDirectory() || !isAccessibleSync(pkgJsonPath)) {
                    continue;
                }

                const pkg = readJsonSync(pkgJsonPath) as { version?: string };

                if (pkg.version) {
                    packages.push({
                        isDev: devDeps.has(pkgName),
                        name: pkgName,
                        version: pkg.version,
                    });
                }

                // Recurse into nested node_modules (npm non-flat installs)
                const nestedNm = join(fullPath, "node_modules");

                if (isAccessibleSync(nestedNm)) {
                    scanDir(nestedNm, "");
                }
            } catch {
                // Skip unreadable packages
            }
        }
    };

    scanDir(nodeModulesPath, "");

    return packages;
};

const LOCKFILE_NAMES: Record<string, { file: string; type: LockFileType }> = {
    bun: { file: "bun.lock", type: "bun" },
    npm: { file: "package-lock.json", type: "npm" },
    pnpm: { file: "pnpm-lock.yaml", type: "pnpm" },
    yarn: { file: "yarn.lock", type: "yarn" },
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
