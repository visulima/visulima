/**
 * Walks `node_modules/` and reads each package's manifest into a single
 * keyed map. Used by policies that need the on-disk `package.json` shape
 * (license, install_scripts, maintainers, …) — the lockfile alone is not
 * sufficient because licenses and lifecycle scripts live in the manifest,
 * not in the resolution metadata.
 *
 * Mirrors the directory walk in `build-scripts.ts` (top-level, scoped
 * dirs, pnpm's `.pnpm/` content-addressed store, and any nested
 * `node_modules`). Entries are deduplicated by `name@version`.
 */

import { lstatSync, readdirSync } from "node:fs";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

/** Maintainer record as it appears in `package.json`. */
export interface ManifestMaintainer {
    email?: string;
    name: string;
}

/** Subset of `package.json` fields the policy engine cares about. */
export interface PackageManifest {
    /** Path to the directory containing `package.json` on disk. */
    directory: string;

    /**
     * Raw license declaration as it appears in the manifest. May be a
     * plain SPDX id, an SPDX expression, the legacy `{ type }` object,
     * or the legacy `licenses[]` array.
     */
    license?: string | { type?: string };
    /** Legacy `licenses` array form. */
    licenses?: { type?: string }[];
    /** Maintainer / publisher list, when declared. */
    maintainers?: ManifestMaintainer[];
    /** Canonical package name. */
    name: string;
    /** Lifecycle script map. */
    scripts?: Record<string, string>;
    /** Installed version (the one recorded in the manifest itself). */
    version: string;
}

type RawManifest = {
    license?: string | { type?: string };
    licenses?: { type?: string }[];
    maintainers?: (ManifestMaintainer | string)[];
    name?: string;
    scripts?: Record<string, string>;
    version?: string;
};

const normalizeMaintainers = (raw: RawManifest["maintainers"]): ManifestMaintainer[] | undefined => {
    if (!Array.isArray(raw) || raw.length === 0) {
        return undefined;
    }

    const result: ManifestMaintainer[] = [];

    for (const entry of raw) {
        if (typeof entry === "string") {
            const trimmed = entry.trim();

            if (trimmed.length > 0) {
                result.push({ name: trimmed });
            }
        } else if (entry && typeof entry === "object" && typeof entry.name === "string") {
            result.push({ email: entry.email, name: entry.name });
        }
    }

    return result.length > 0 ? result : undefined;
};

/**
 * Reads every package manifest under `node_modules/` (including nested
 * trees and pnpm's `.pnpm/` store). Returns a map keyed by
 * `name@version` for fast lookup by policy modules. Unreadable
 * directories are silently skipped — the result is best-effort, not
 * authoritative.
 */
export const readNodeModulesManifests = (cwd: string): Map<string, PackageManifest> => {
    const nodeModulesPath = join(cwd, "node_modules");

    if (!isAccessibleSync(nodeModulesPath)) {
        return new Map();
    }

    const result = new Map<string, PackageManifest>();

    // Cycle guard: a workspace-linked `node_modules` can point back into
    // the source tree and the walk would otherwise recurse forever.
    const visited = new Set<string>();

    const scanDir = (dir: string, scopePrefix = ""): void => {
        if (visited.has(dir)) {
            return;
        }

        visited.add(dir);

        let entries: string[];

        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = join(dir, entry);

            // Use lstat so a symlinked workspace package doesn't get
            // slurped into the manifest map. The `.pnpm/` store entries
            // below are real directories so they're unaffected.
            let stat;

            try {
                stat = lstatSync(fullPath);
            } catch {
                continue;
            }

            if (stat.isSymbolicLink()) {
                continue;
            }

            if (entry.startsWith("@")) {
                if (stat.isDirectory()) {
                    scanDir(fullPath, `${entry}/`);
                }

                continue;
            }

            // Recurse into pnpm's content-addressed store so we can read
            // manifests of packages that only live under `.pnpm/` (peer
            // copies, non-hoisted transitives, …). Same dedup trick as
            // `collectBuildScriptPackages`.
            if (entry === ".pnpm" && scopePrefix === "") {
                let storeEntries: string[];

                try {
                    storeEntries = readdirSync(fullPath);
                } catch {
                    continue;
                }

                for (const storeEntry of storeEntries) {
                    const storeNm = join(fullPath, storeEntry, "node_modules");

                    if (isAccessibleSync(storeNm)) {
                        scanDir(storeNm);
                    }
                }

                continue;
            }

            if (entry.startsWith(".") || !stat.isDirectory()) {
                continue;
            }

            const pkgName = scopePrefix + entry;
            const pkgJsonPath = join(fullPath, "package.json");

            try {
                if (!isAccessibleSync(pkgJsonPath)) {
                    continue;
                }

                const raw = readJsonSync(pkgJsonPath) as RawManifest;

                if (typeof raw.version !== "string") {
                    continue;
                }

                const key = `${pkgName}@${raw.version}`;

                if (!result.has(key)) {
                    result.set(key, {
                        directory: fullPath,
                        license: raw.license,
                        licenses: Array.isArray(raw.licenses) ? raw.licenses : undefined,
                        maintainers: normalizeMaintainers(raw.maintainers),
                        name: pkgName,
                        scripts: raw.scripts && typeof raw.scripts === "object" ? raw.scripts : undefined,
                        version: raw.version,
                    });
                }

                const nested = join(fullPath, "node_modules");

                if (isAccessibleSync(nested)) {
                    scanDir(nested);
                }
            } catch {
                // Skip unreadable packages.
            }
        }
    };

    scanDir(nodeModulesPath);

    return result;
};
