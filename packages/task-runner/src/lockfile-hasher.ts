import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { readPackageDeps } from "./utils";

/**
 * Resolved dependency entry from a lockfile.
 */
export interface ResolvedDependency {
    /** The package name */
    name: string;
    /** The resolved version */
    version: string;
}

/**
 * Result of parsing a lockfile for a specific package.
 */
export interface PackageLockfileHash {
    /** Hash of the resolved dependencies relevant to this package */
    hash: string;
    /** The resolved dependencies that were included in the hash */
    dependencies: ResolvedDependency[];
}

/**
 * Smart lockfile hasher that only hashes the resolved versions
 * of a package's actual dependencies, not the entire lockfile.
 *
 * This matches Turborepo's smart lockfile hashing behavior:
 * changing the lockfile only busts cache for affected packages.
 *
 * Supports:
 * - package-lock.json (npm v2/v3)
 * - pnpm-lock.yaml (pnpm)
 * - yarn.lock (Yarn Classic + Berry)
 */
export class LockfileHasher {
    readonly #workspaceRoot: string;
    #lockfileCache: Map<string, Map<string, string>> | null = null;
    #lockfileType: "npm" | "pnpm" | "yarn" | null = null;

    constructor(workspaceRoot: string) {
        this.#workspaceRoot = workspaceRoot;
    }

    /**
     * Computes a hash based only on the resolved dependency versions
     * relevant to a specific package.
     *
     * @param packageJsonPath - Path to the package.json (relative to workspace root)
     * @returns Hash of the relevant lockfile entries, or null if no lockfile found
     */
    async hashForPackage(packageJsonPath: string): Promise<PackageLockfileHash | null> {
        const fullPath = join(this.#workspaceRoot, packageJsonPath);
        const deps = await readPackageDeps(fullPath);

        if (!deps || deps.size === 0) {
            return null;
        }

        // Parse the lockfile (cached)
        const resolvedVersions = await this.#getResolvedVersions();

        if (!resolvedVersions) {
            return null;
        }

        // Collect resolved versions for this package's dependencies
        const resolved: ResolvedDependency[] = [];

        for (const depName of deps) {
            const version = resolvedVersions.get(depName);

            if (version) {
                resolved.push({ name: depName, version });
            }
        }

        if (resolved.length === 0) {
            return null;
        }

        // Sort for deterministic hashing
        resolved.sort((a, b) => a.name.localeCompare(b.name));

        // Compute hash
        const hash = createHash("sha256");

        for (const dep of resolved) {
            hash.update(`${dep.name}@${dep.version}`);
        }

        return {
            hash: hash.digest("hex"),
            dependencies: resolved,
        };
    }

    /**
     * Returns the type of lockfile detected, or null if none found.
     */
    get lockfileType(): "npm" | "pnpm" | "yarn" | null {
        return this.#lockfileType;
    }

    /**
     * Clears the cached lockfile data.
     */
    clearCache(): void {
        this.#lockfileCache = null;
        this.#lockfileType = null;
    }

    /**
     * Parses the workspace lockfile and returns a map of package name → resolved version.
     * Results are cached for subsequent calls.
     */
    async #getResolvedVersions(): Promise<Map<string, string> | null> {
        if (this.#lockfileCache !== null) {
            // Return cached result (empty map means "no lockfile found")
            return this.#lockfileCache.size > 0 ? this.#lockfileCache : null;
        }

        const parsers: Array<{ file: string; type: "npm" | "pnpm" | "yarn"; parser: (content: string) => Map<string, string> }> = [
            { file: "package-lock.json", type: "npm", parser: parseNpmLockfile },
            { file: "pnpm-lock.yaml", type: "pnpm", parser: parsePnpmLockfile },
            { file: "yarn.lock", type: "yarn", parser: parseYarnLockfile },
        ];

        for (const { file, type, parser } of parsers) {
            try {
                const content = await readFile(join(this.#workspaceRoot, file), "utf-8");
                const versions = parser(content);

                this.#lockfileCache = versions;
                this.#lockfileType = type;

                return versions;
            } catch {
                // Try next format
            }
        }

        // Cache the "not found" result as empty map to avoid repeated file reads
        this.#lockfileCache = new Map();

        return null;
    }
}

/**
 * Parses package-lock.json (npm v2/v3 format) to extract resolved versions.
 * The v2/v3 format uses a flat "packages" map with paths like "node_modules/pkg-name".
 */
export const parseNpmLockfile = (content: string): Map<string, string> => {
    const versions = new Map<string, string>();

    try {
        const lockfile = JSON.parse(content) as {
            lockfileVersion?: number;
            packages?: Record<string, { version?: string }>;
            dependencies?: Record<string, { version?: string }>;
        };

        // v2/v3 format (flat packages map)
        if (lockfile.packages) {
            for (const [path, entry] of Object.entries(lockfile.packages)) {
                if (!path || !entry.version) {
                    continue;
                }

                // Extract package name from path like "node_modules/@scope/name"
                const name = extractPackageName(path);

                if (name) {
                    // Use the first (top-level) occurrence
                    if (!versions.has(name)) {
                        versions.set(name, entry.version);
                    }
                }
            }
        }

        // v1 fallback (nested dependencies)
        if (versions.size === 0 && lockfile.dependencies) {
            for (const [name, entry] of Object.entries(lockfile.dependencies)) {
                if (entry.version) {
                    versions.set(name, entry.version);
                }
            }
        }
    } catch {
        // Invalid JSON
    }

    return versions;
};

/**
 * Parses pnpm-lock.yaml to extract resolved versions.
 * Uses a lightweight regex-based parser to avoid a YAML dependency.
 */
export const parsePnpmLockfile = (content: string): Map<string, string> => {
    const versions = new Map<string, string>();

    // pnpm lockfile v6+ uses a "packages:" section with entries like:
    //   /@scope/name@1.2.3:
    //     resolution: {integrity: sha512-...}
    // or in v9+:
    //   '@scope/name@1.2.3':
    //     resolution: {integrity: sha512-...}
    //
    // We also check for the "importers:" / "dependencies:" section pattern:
    //   dependencies:
    //     pkg-name:
    //       specifier: ^1.0.0
    //       version: 1.2.3

    // Strategy 1: Parse the importers/dependencies section for version entries
    const depVersionRegex = /^\s{4,}(\S+):\s*$\n\s+specifier:.*\n\s+version:\s*'?([^'\n(]+)/gm;
    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((match = depVersionRegex.exec(content)) !== null) {
        const name = (match[1] as string).replace(/^['"]|['"]$/g, "");
        let version = (match[2] as string).trim();

        // pnpm may append resolution info in parentheses
        const parenIndex = version.indexOf("(");

        if (parenIndex > 0) {
            version = version.slice(0, parenIndex).trim();
        }

        if (!versions.has(name)) {
            versions.set(name, version);
        }
    }

    // Strategy 2: Parse the packages section for /@scope/name@version entries
    if (versions.size === 0) {
        const packagesRegex = /^\s{2}[/'"]?(?:@([^/@']+)\/)?([^@']+)@(\d[^:'"\s]*)/gm;

        // eslint-disable-next-line no-cond-assign
        while ((match = packagesRegex.exec(content)) !== null) {
            const scope = match[1];
            const name = scope ? `@${scope}/${match[2]}` : (match[2] as string);
            const version = match[3] as string;

            if (!versions.has(name)) {
                versions.set(name, version);
            }
        }
    }

    return versions;
};

/**
 * Parses yarn.lock to extract resolved versions.
 * Works with both Yarn Classic (v1) and Berry (v2+) formats.
 */
export const parseYarnLockfile = (content: string): Map<string, string> => {
    const versions = new Map<string, string>();

    // Yarn v1 format:
    //   "package-name@^1.0.0":
    //     version "1.2.3"
    //
    // Yarn Berry format:
    //   "package-name@npm:^1.0.0":
    //     version: 1.2.3

    const entryRegex = /^["']?(?:@([^/@"']+)\/)?([^@"']+)@[^"'\n]+["']?:?\s*\n\s+version:?\s+"?([^"\n]+)"?/gm;
    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((match = entryRegex.exec(content)) !== null) {
        const scope = match[1];
        const name = scope ? `@${scope}/${match[2]}` : (match[2] as string);
        const version = (match[3] as string).trim();

        // Keep first occurrence (highest-priority resolution)
        if (!versions.has(name)) {
            versions.set(name, version);
        }
    }

    return versions;
};

/**
 * Extracts a package name from a node_modules path.
 * E.g., "node_modules/@scope/name" → "@scope/name"
 *       "node_modules/name" → "name"
 *       "node_modules/.package-lock.json" → null
 */
export const extractPackageName = (path: string): string | null => {
    // Match the last node_modules segment (handles nested node_modules)
    const match = /.*node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(path);

    if (!match || !match[1]) {
        return null;
    }

    const name = match[1];

    // Skip internal/hidden entries
    if (name.startsWith(".")) {
        return null;
    }

    return name;
};
