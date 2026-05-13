/**
 * Static reachability filter (Tier 1).
 *
 * Walks the workspace source tree, tokenizes JS/TS files for ES + CJS
 * imports and dynamic `import("pkg")` calls with string-literal arguments,
 * and unions the result with every `package.json`'s `dependencies` /
 * `devDependencies` / `peerDependencies` map.
 *
 * Returns the intersection of `vulnerablePackages` and `importedPackages`.
 * Known false-negatives — variable-resolved requires, plugin/preset
 * chains, loader-glob patterns — are tracked in the RFC as Tier 2 / Tier
 * 3 work and have a documented `alwaysAssumeUsed` escape hatch.
 */

import { readFileSync } from "node:fs";

import { collectSync, readJsonSync } from "@visulima/fs";

const SOURCE_EXTENSIONS = ["ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts"];

const DEFAULT_SKIP: RegExp[] = [/node_modules/, /\.git/, /\.next/, /\.cache/, /dist/, /build/, /coverage/, /\.turbo/, /\.nx/, /\.parcel-cache/];

const PACKAGE_JSON_DEP_KEYS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

const ES_IMPORT_RE = /(?:import|export)\s+(?:[\s\S]*?from\s+)?["']([^"'\n]+)["']/g;
const CJS_BARE_CALL_RE = /(?:^|[^.\w$])require\s*\(\s*["']([^"'\n]+)["']\s*\)/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g;

const normalizePackageName = (specifier: string): string | undefined => {
    if (specifier.startsWith(".") || specifier.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(specifier)) {
        return undefined;
    }

    const trimmed = specifier.trim();

    if (trimmed.length === 0) {
        return undefined;
    }

    if (trimmed.startsWith("@")) {
        const parts = trimmed.split("/");

        if (parts.length < 2) {
            return undefined;
        }

        return `${parts[0]}/${parts[1]}`;
    }

    return trimmed.split("/")[0];
};

const extractImportedNames = (source: string): Set<string> => {
    const found = new Set<string>();
    const stripped = source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|[^:])\/\/.*$/gm, "$1");

    const collect = (regex: RegExp): void => {
        regex.lastIndex = 0;

        let match: RegExpExecArray | null;

        // eslint-disable-next-line no-cond-assign
        while ((match = regex.exec(stripped)) !== null) {
            const name = normalizePackageName(match[1]!);

            if (name) {
                found.add(name);
            }
        }
    };

    collect(ES_IMPORT_RE);
    collect(CJS_BARE_CALL_RE);
    collect(DYNAMIC_IMPORT_RE);

    return found;
};

const extractPackageJsonNames = (jsonPath: string): Set<string> => {
    const found = new Set<string>();

    try {
        const pkg = readJsonSync(jsonPath) as Record<string, unknown>;

        for (const key of PACKAGE_JSON_DEP_KEYS) {
            const map = pkg[key];

            if (map && typeof map === "object" && !Array.isArray(map)) {
                for (const name of Object.keys(map)) {
                    found.add(name);
                }
            }
        }
    } catch {
        // unreadable package.json — silently skip
    }

    return found;
};

export interface ReachabilityOptions {
    /** Force-keep these packages even if not statically imported (loaders, plugin chains, etc.). */
    alwaysAssumeUsed?: string[];
    /** Limit the walk to a subset of source extensions. */
    extensions?: string[];
    /** Override the file-walk skip list. Defaults to common build artefact directories. */
    skip?: RegExp[];
    /** Names of vulnerable packages to filter. Anything not in this set is ignored. */
    vulnerablePackages: Set<string>;
    workspaceRoot: string;
}

export interface ReachabilityResult {
    /** Files scanned. */
    filesScanned: number;
    /** Full set of statically-imported package names — useful for debugging. */
    importedTotal: Set<string>;
    /** Subset of `vulnerablePackages` that the static scan considers reachable. */
    reachable: Set<string>;
}

/**
 * Scan the workspace for static imports and return the subset of vulnerable
 * packages that look reachable. Synchronous because the walk is CPU-bound
 * over local files — async wrapping would add zero throughput.
 */
export const computeReachableVulnerablePackages = (options: ReachabilityOptions): ReachabilityResult => {
    const skip = options.skip ?? DEFAULT_SKIP;
    const extensions = options.extensions ?? SOURCE_EXTENSIONS;

    const imported = new Set<string>();
    let filesScanned = 0;

    const sourceFiles = collectSync(options.workspaceRoot, {
        extensions,
        includeDirs: false,
        skip,
    });

    for (const path of sourceFiles) {
        filesScanned += 1;

        try {
            const source = readFileSync(path, "utf8");

            for (const name of extractImportedNames(source)) {
                imported.add(name);
            }
        } catch {
            // unreadable source — silently skip
        }
    }

    const packageJsonFiles = collectSync(options.workspaceRoot, {
        extensions: ["json"],
        includeDirs: false,
        skip,
    }).filter((path) => path.endsWith("/package.json") || path.endsWith(String.raw`\package.json`) || path.endsWith("package.json"));

    for (const path of packageJsonFiles) {
        for (const name of extractPackageJsonNames(path)) {
            imported.add(name);
        }
    }

    if (options.alwaysAssumeUsed) {
        for (const name of options.alwaysAssumeUsed) {
            imported.add(name);
        }
    }

    const reachable = new Set<string>();

    for (const name of options.vulnerablePackages) {
        if (imported.has(name)) {
            reachable.add(name);
        }
    }

    return {
        filesScanned,
        importedTotal: imported,
        reachable,
    };
};

export { extractImportedNames, normalizePackageName };
