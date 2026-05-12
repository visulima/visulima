import { readdirSync, statSync } from "node:fs";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

interface BinConflict {
    bin: string;
    packages: { name: string; relativePath: string }[];
}

/**
 * Walks every package under `node_modules` (and `.pnpm`) and collects
 * `bin` entries. Returns name collisions — two or more packages exposing
 * the same bin name — minus anything blessed in `allowBins`. Two copies
 * of the *same* package don't count (npm/yarn hoisting + nested copies
 * are normal). Mirrors LavaMoat's experimental `whichbin` firewall.
 *
 * `allowBins` keys may be either bare bin names (`tsc: true`) or
 * `pkg#bin` qualifiers (`typescript#tsc: true`) for narrower opt-ins.
 */
const collectBinShadows = (cwd: string, allowBins: Record<string, boolean> = {}): BinConflict[] => {
    const nodeModulesPath = join(cwd, "node_modules");

    if (!isAccessibleSync(nodeModulesPath)) {
        return [];
    }

    const byBin = new Map<string, { name: string; relativePath: string }[]>();
    const seenPkgs = new Set<string>();

    const recordBin = (binName: string, pkgName: string, fullPath: string): void => {
        const id = `${pkgName}@${fullPath}`;

        if (seenPkgs.has(id)) {
            return;
        }

        seenPkgs.add(id);

        const relativePath = fullPath.startsWith(cwd) ? fullPath.slice(cwd.length + 1) : fullPath;
        let list = byBin.get(binName);

        if (!list) {
            list = [];
            byBin.set(binName, list);
        }

        if (!list.some((entry) => entry.name === pkgName)) {
            list.push({ name: pkgName, relativePath });
        }
    };

    const scanDir = (dir: string, scopePrefix = ""): void => {
        let entries: string[];

        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = join(dir, entry);

            if (entry.startsWith("@")) {
                scanDir(fullPath, `${entry}/`);
                continue;
            }

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

            if (entry.startsWith(".")) {
                continue;
            }

            const pkgName = scopePrefix + entry;
            const pkgJsonPath = join(fullPath, "package.json");

            try {
                if (!statSync(fullPath).isDirectory() || !isAccessibleSync(pkgJsonPath)) {
                    continue;
                }

                const pkg = readJsonSync(pkgJsonPath) as { bin?: Record<string, string> | string; name?: string };
                const canonicalName = typeof pkg.name === "string" ? pkg.name : pkgName;

                if (typeof pkg.bin === "string") {
                    const binName = canonicalName.includes("/") ? canonicalName.split("/").pop()! : canonicalName;

                    recordBin(binName, canonicalName, fullPath);
                } else if (pkg.bin && typeof pkg.bin === "object") {
                    for (const binName of Object.keys(pkg.bin)) {
                        recordBin(binName, canonicalName, fullPath);
                    }
                }

                const nested = join(fullPath, "node_modules");

                if (isAccessibleSync(nested)) {
                    scanDir(nested);
                }
            } catch {
                /* skip unreadable */
            }
        }
    };

    scanDir(nodeModulesPath);

    const conflicts: BinConflict[] = [];

    for (const [bin, list] of byBin) {
        if (list.length < 2) {
            continue;
        }

        if (allowBins[bin] === true) {
            continue;
        }

        const allBlessed = list.every((entry) => allowBins[`${entry.name}#${bin}`] === true);

        if (allBlessed) {
            continue;
        }

        conflicts.push({ bin, packages: list });
    }

    return conflicts.sort((a, b) => a.bin.localeCompare(b.bin));
};

export type { BinConflict };
export { collectBinShadows };
