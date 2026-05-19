/**
 * `blockExoticSubdeps` enforcement — flags transitive dependency edges
 * that resolve from an *exotic* source (a git repository or a direct
 * remote tarball URL) rather than the registry.
 *
 * This is vis's PM-agnostic counterpart to pnpm's `blockExoticSubdeps`.
 * For pnpm, vis already mirrors the knob into `pnpm-workspace.yaml`
 * (pnpm enforces it natively, and its parser pre-resolves exotic specs
 * away); this scanner closes the equivalent gap for **npm / yarn / bun**,
 * whose lockfiles preserve the raw specifier on every dependency edge.
 *
 * Threat model: an exotic source on a *direct* dependency is the user's
 * explicit choice. An exotic source reached only *transitively* means
 * some dependency is pulling unaudited code from an arbitrary git ref or
 * URL — exactly what supply-chain policy should block. Every specifier
 * inside a lockfile entry's own dependency maps is, by definition, a
 * transitive edge (the declaring side is itself a dependency, never a
 * workspace root), so iterating entry dep-maps is a precise model of
 * "transitive dependency using an exotic source" with no direct-vs-
 * transitive ambiguity.
 *
 * Offline + pure: a single lockfile parse, no network, no fs walk.
 */

import { readFileSync } from "@visulima/fs";
import { parseLockFileContent } from "@visulima/package";
import { join } from "@visulima/path";

import { LOCKFILE_NAMES } from "./dependency-scan";

export interface ExoticSubdepViolation {
    /** Package that declared the exotic edge (the transitive parent). */
    declaredBy: string;
    /** Dependency name pulled from the exotic source. */
    packageName: string;
    /** The raw exotic specifier recorded in the lockfile. */
    source: string;
}

export interface ScanExoticSubdepsOptions {
    /**
     * Package names exempted from the check. Bare names and a trailing
     * `*` glob (`@scope/*`) are supported — same grammar as the policy
     * exclude lists.
     */
    allow?: string[];
}

/**
 * A specifier is exotic when it points at a git repo or a direct remote
 * archive. Registry ranges (`^1.0.0`, `1.2.3`, `~2`), `npm:` aliases
 * (still registry-backed), and local protocols (`workspace:`, `link:`,
 * `file:`, `portal:`) are intentionally *not* exotic — pnpm's
 * `blockExoticSubdeps` targets git + remote tarball URLs specifically.
 */
const isExoticSpecifier = (spec: string): boolean => {
    const value = spec.trim();

    if (value === "") {
        return false;
    }

    if (/^(?:git\+|git:\/\/|git@|ssh:\/\/)/i.test(value)) {
        return true;
    }

    if (/^(?:github|gitlab|bitbucket|gist):/i.test(value)) {
        return true;
    }

    // A bare `owner/repo` (optionally `#ref`) is npm's GitHub shorthand.
    if (/^[\w.-]+\/[\w.-]+(?:#.+)?$/.test(value) && !value.includes("@")) {
        return true;
    }

    return /^https?:\/\//i.test(value);
};

const matchesAllow = (name: string, allow: string[]): boolean => {
    for (const pattern of allow) {
        if (pattern === name) {
            return true;
        }

        if (pattern.endsWith("*") && name.startsWith(pattern.slice(0, -1))) {
            return true;
        }
    }

    return false;
};

/**
 * Parse the workspace lockfile and return every transitive dependency
 * edge whose recorded specifier is exotic. Returns an empty array for
 * unknown package managers, a missing/unparseable lockfile, or when
 * every exotic edge is allow-listed.
 */
export const scanExoticSubdeps = (workspaceRoot: string, pmName: string, options: ScanExoticSubdepsOptions = {}): ExoticSubdepViolation[] => {
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

    const allow = options.allow ?? [];
    const violations: ExoticSubdepViolation[] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
        const declaredBy = `${entry.name}@${entry.version}`;

        for (const depMap of [entry.dependencies, entry.optionalDependencies]) {
            if (!depMap) {
                continue;
            }

            for (const [depName, specifiers] of Object.entries(depMap)) {
                if (matchesAllow(depName, allow)) {
                    continue;
                }

                for (const spec of specifiers) {
                    if (!isExoticSpecifier(spec)) {
                        continue;
                    }

                    const key = `${declaredBy}->${depName}@${spec}`;

                    if (seen.has(key)) {
                        continue;
                    }

                    seen.add(key);
                    violations.push({ declaredBy, packageName: depName, source: spec });
                }
            }
        }
    }

    return violations.sort((a, b) => a.packageName.localeCompare(b.packageName) || a.declaredBy.localeCompare(b.declaredBy));
};
