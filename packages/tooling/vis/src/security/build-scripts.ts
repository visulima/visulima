import { readdirSync, statSync } from "node:fs";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

/** Lifecycle hook names vis inspects when deciding whether a package has build scripts. */
const BUILD_HOOKS = ["preinstall", "install", "postinstall", "prepare"] as const;

interface BuildScriptEntry {
    /** Path to the package directory on disk (first occurrence — used for diagnostics). */
    directory: string;
    /** Hook names declared in package.json plus a synthetic "install (binding.gyp)" if applicable. */
    hooks: string[];
    /** Canonical package name, e.g. `sharp` or `@prisma/client`. */
    name: string;
    /** Installed version, when readable from package.json. */
    version?: string;
}

/**
 * Walks every package under `node_modules` (including nested `node_modules`)
 * and reports the ones that declare lifecycle scripts. A package with no
 * preinstall/install/postinstall but a top-level `binding.gyp` is flagged
 * as well, because npm synthesises an implicit `install: node-gyp rebuild`
 * in that case (port of LavaMoat allow-scripts' binding.gyp heuristic).
 * Same-named packages at multiple paths are collapsed to a single entry.
 */
const collectBuildScriptPackages = (cwd: string): BuildScriptEntry[] => {
    const nodeModulesPath = join(cwd, "node_modules");

    if (!isAccessibleSync(nodeModulesPath)) {
        return [];
    }

    const seen = new Map<string, BuildScriptEntry>();

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

            // pnpm's content-addressed store: `.pnpm/<name>@<ver>[+<peerhash>]/node_modules/<pkg>`.
            // Direct-dep symlinks at the top level reach hoisted/peer copies, but
            // packages no top-level dep links to (sibling peers, optional deps not
            // chosen by the resolver, etc.) only live under `.pnpm` — without an
            // explicit recurse here they would never be scanned. Dedup-by-name in
            // `seen` collapses duplicates reached via both paths.
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

                const pkg = readJsonSync(pkgJsonPath) as { scripts?: Record<string, string>; version?: string };
                const scripts = pkg.scripts ?? {};
                const declared: string[] = BUILD_HOOKS.filter((h) => scripts[h]);

                // LavaMoat allow-scripts heuristic: package ships binding.gyp
                // but declares no install scripts — npm runs `node-gyp rebuild`
                // implicitly. Treat as install-script for approval purposes.
                if (!scripts.preinstall && !scripts.install && !scripts.postinstall && isAccessibleSync(join(fullPath, "binding.gyp"))) {
                    declared.push("install (binding.gyp)");
                }

                if (declared.length > 0 && !seen.has(pkgName)) {
                    seen.set(pkgName, { directory: fullPath, hooks: declared, name: pkgName, version: typeof pkg.version === "string" ? pkg.version : undefined });
                }

                const nested = join(fullPath, "node_modules");

                if (isAccessibleSync(nested)) {
                    scanDir(nested);
                }
            } catch {
                // Skip unreadable packages
            }
        }
    };

    scanDir(nodeModulesPath);

    return [...seen.values()];
};

/**
 * Splits an allowlist key into its name and (optional) version selector.
 * Accepts `foo`, `foo@1.2.3`, `@org/foo`, `@org/foo@1.2.3`, `foo@*`,
 * `@org/*`. Returns `version: undefined` when no `@version` suffix is
 * present (and `@org/foo` is treated as a scoped name, not a version).
 */
const splitAllowKey = (key: string): { name: string; version?: string } => {
    const isScoped = key.startsWith("@");
    const atIndex = key.indexOf("@", isScoped ? 1 : 0);

    if (atIndex === -1) {
        return { name: key };
    }

    return { name: key.slice(0, atIndex), version: key.slice(atIndex + 1) };
};

/**
 * True iff `entry` is matched by any allowed pattern in `allowBuilds`.
 *
 * When `pinVersions` is true, allowlist keys may carry a `@version` suffix
 * (`foo@1.2.3`). Only the installed version satisfies the entry; bumping the
 * dependency invalidates the approval. Bare names (no `@version`) still
 * match any version — same behavior as `pinVersions: false`.
 */
const isPatternAllowed = (entry: BuildScriptEntry, allowBuilds: Record<string, boolean>, pinVersions: boolean): boolean => {
    for (const [pattern, allowed] of Object.entries(allowBuilds)) {
        if (!allowed) {
            continue;
        }

        if (pattern.endsWith("@*")) {
            const bare = pattern.slice(0, -2);

            if (bare === entry.name) {
                return true;
            }

            continue;
        }

        if (pattern.endsWith("*")) {
            if (entry.name.startsWith(pattern.slice(0, -1))) {
                return true;
            }

            continue;
        }

        const { name, version } = splitAllowKey(pattern);

        if (name !== entry.name) {
            continue;
        }

        if (!pinVersions || version === undefined) {
            return true;
        }

        if (entry.version === version) {
            return true;
        }
    }

    return false;
};

interface BuildScriptStatus {
    /**
     * `allowBuilds` patterns that did not match any installed package.
     * These are stale entries the user can prune (excess policy).
     */
    excess: string[];
    /** Packages with build scripts that ARE approved. */
    installed: BuildScriptEntry[];

    /** Packages with build scripts that are NOT covered by `allowBuilds`. */
    unapproved: BuildScriptEntry[];

    /**
     * Version-drift suggestions when `pinVersions: true` — entries pointing
     * at an old version, with the new version that should replace them.
     * Empty unless `pinVersions` is enabled.
     */
    versionDrift: { from: string; to: string }[];
}

/**
 * Returns a full triage of installed build-script packages versus the
 * `allowBuilds` config — what's unapproved, what's approved, which
 * allowlist entries no longer match anything (excess / stale), and any
 * version-drift suggestions when `pinVersions: true`.
 */
const scanBuildScriptStatus = (
    cwd: string,
    allowBuilds: Record<string, boolean>,
    options: { pinVersions?: boolean } = {},
): BuildScriptStatus => {
    const pinVersions = options.pinVersions === true;
    const installed = collectBuildScriptPackages(cwd);
    const unapproved: BuildScriptEntry[] = [];
    const approved: BuildScriptEntry[] = [];
    const installedByName = new Map<string, BuildScriptEntry>(installed.map((p) => [p.name, p]));

    for (const entry of installed) {
        if (isPatternAllowed(entry, allowBuilds, pinVersions)) {
            approved.push(entry);
        } else {
            unapproved.push(entry);
        }
    }

    const excess: string[] = [];
    const versionDrift: { from: string; to: string }[] = [];

    for (const [pattern, allowed] of Object.entries(allowBuilds)) {
        if (!allowed) {
            continue;
        }

        if (pattern.endsWith("@*")) {
            const bare = pattern.slice(0, -2);

            if (!installedByName.has(bare)) {
                excess.push(pattern);
            }

            continue;
        }

        if (pattern.endsWith("*")) {
            const prefix = pattern.slice(0, -1);
            const matched = [...installedByName.keys()].some((n) => n.startsWith(prefix));

            if (!matched) {
                excess.push(pattern);
            }

            continue;
        }

        const { name, version } = splitAllowKey(pattern);
        const installedEntry = installedByName.get(name);

        if (!installedEntry) {
            excess.push(pattern);
            continue;
        }

        if (pinVersions && version !== undefined && version !== "*" && installedEntry.version && installedEntry.version !== version) {
            versionDrift.push({ from: pattern, to: `${name}@${installedEntry.version}` });
        }
    }

    return { excess, installed: approved, unapproved, versionDrift };
};

/**
 * Backwards-compatible wrapper returning the legacy `string[]` shape:
 * one entry per unapproved package as `"&lt;name> (&lt;hooks>)"`. New callers
 * should prefer `scanBuildScriptStatus` for the structured report.
 */
const scanUnapprovedBuildScripts = (cwd: string, allowBuilds: Record<string, boolean>): string[] =>
    scanBuildScriptStatus(cwd, allowBuilds).unapproved.map((entry) => `${entry.name} (${entry.hooks.join(", ")})`);

export type { BuildScriptEntry, BuildScriptStatus };
export { BUILD_HOOKS, collectBuildScriptPackages, isPatternAllowed, scanBuildScriptStatus, scanUnapprovedBuildScripts, splitAllowKey };
