import { existsSync, readFileSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { getManifestData } from "@socketsecurity/registry";
import { join, resolve } from "@visulima/path";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- module-replacements ships JSON manifests
// @ts-expect-error -- JSON import with assertion
import nativeManifest from "module-replacements/manifests/native.json" with { type: "json" };
// @ts-expect-error -- JSON import with assertion
import preferredManifest from "module-replacements/manifests/preferred.json" with { type: "json" };
// @ts-expect-error -- JSON import with assertion
import microUtilitiesManifest from "module-replacements/manifests/micro-utilities.json" with { type: "json" };
import { coerce } from "semver";

import { info, note, success, warn } from "../output";
import type { OverrideEntry, PmInfo } from "../overrides";
import { applyOverrides, lockfileContainsPackage, readLockfileText } from "../overrides";
import { detectPm, runInstall } from "../pm-runner";
import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../workspace";

/**
 * A single entry from the `@socketsecurity/registry` manifest.
 *
 * @see https://www.npmjs.com/package/@socketsecurity/registry
 */
interface ManifestEntryData {
    /** Category tags (e.g., `"cleanup"`, `"speedup"`). */
    categories?: string[];
    /** Whether this registry package is deprecated. */
    deprecated?: boolean;
    /** The `@socketregistry/<name>` package name. */
    name: string;
    /** The original npm package being replaced. */
    package: string;
    /** The safe version of the replacement package. */
    version: string;
}

type ManifestEntry = [string, ManifestEntryData];

interface OptimizeOptions {
    dryRun: boolean;
    pin: boolean;
    prod: boolean;
}

/** Aggregate result of the optimize operation across all workspaces. */
interface OptimizeResult {
    /** Package names that were newly added as overrides. */
    added: string[];
    /** All computed override entries (used for dry-run display). */
    entries: OverrideEntry[];
    /** Number of manifest entries skipped (not found in deps or lockfile). */
    skipped: number;
    /** Package names whose override specs were updated. */
    updated: string[];
    /** Workspace directories that contributed dependencies. */
    workspaces: string[];
}

// ── e18e module-replacements analysis ───────────────────────────────

interface E18eManifest {
    mappings: Record<string, { moduleName: string; replacements: string[] }>;
    replacements: Record<string, { description?: string; id: string; type: string }>;
}

/** A package that can be replaced with a native builtin, lighter alternative, or removed. */
interface E18eSuggestion {
    /** Category: native builtin, preferred alternative, or micro-utility. */
    category: "micro-utility" | "native" | "preferred";
    /** The original package name. */
    packageName: string;
    /** Human-readable replacement description. */
    replacement: string;
}

/**
 * Scans dependencies against the `module-replacements` manifests to find
 * packages replaceable with native builtins, lighter alternatives, or inline code.
 *
 * @param allDeps - Set of all dependency names across root and workspaces.
 * @returns Suggestions grouped by category.
 */
const analyzeE18eReplacements = (allDeps: Set<string>): E18eSuggestion[] => {
    const suggestions: E18eSuggestion[] = [];

    const scanManifest = (manifest: E18eManifest, category: E18eSuggestion["category"]): void => {
        for (const [, mapping] of Object.entries(manifest.mappings)) {
            if (!allDeps.has(mapping.moduleName)) {
                continue;
            }

            const replacementIds = mapping.replacements;
            const descriptions: string[] = [];

            for (const rid of replacementIds) {
                const rep = manifest.replacements[rid];

                if (rep) {
                    descriptions.push(rep.description ?? rep.id);
                }
            }

            suggestions.push({
                category,
                packageName: mapping.moduleName,
                replacement: descriptions.join(", ") || replacementIds.join(", "),
            });
        }
    };

    scanManifest(nativeManifest as E18eManifest, "native");
    scanManifest(preferredManifest as E18eManifest, "preferred");
    scanManifest(microUtilitiesManifest as E18eManifest, "micro-utility");

    return suggestions;
};

/**
 * Collects all dependency names from a `package.json` file.
 *
 * @param pkgJsonPath - Absolute path to the `package.json`.
 * @param prodOnly - When `true`, skips `devDependencies` and `peerDependencies`.
 */
const collectDepsFromPkgJson = (pkgJsonPath: string, prodOnly: boolean): Set<string> => {
    const deps = new Set<string>();

    try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            optionalDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };

        const maps = prodOnly
            ? [pkg.dependencies, pkg.optionalDependencies]
            : [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies];

        for (const depMap of maps) {
            if (depMap) {
                for (const name of Object.keys(depMap)) {
                    deps.add(name);
                }
            }
        }
    } catch {
        // package.json may not exist for all workspace dirs
    }

    return deps;
};

/**
 * Discovers workspace package directories by reading `pnpm-workspace.yaml`
 * or the `workspaces` field in the root `package.json`.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @returns Relative directory paths to each workspace package.
 */
const discoverWorkspacePackages = (workspaceRoot: string): string[] => {
    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);

    if (pnpmPatterns) {
        return resolveWorkspacePatterns(workspaceRoot, pnpmPatterns);
    }

    const rootPkgPath = join(workspaceRoot, "package.json");

    if (!existsSync(rootPkgPath)) {
        return [];
    }

    try {
        const pkg = JSON.parse(readFileSync(rootPkgPath, "utf8")) as {
            workspaces?: string[] | { packages?: string[] };
        };

        const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages;

        return patterns ? resolveWorkspacePatterns(workspaceRoot, patterns) : [];
    } catch {
        return [];
    }
};

/**
 * Core optimization logic.
 *
 * Scans root and workspace deps + lockfile against the `@socketregistry`
 * manifest, builds override entries for matched packages, and applies
 * them to the correct config file for the detected package manager.
 */
/* eslint-disable sonarjs/cognitive-complexity */
const executeOptimize = (
    workspaceRoot: string,
    manifest: ManifestEntry[],
    pm: PmInfo,
    allDeps: Set<string>,
    workspacesWithDeps: string[],
    options: OptimizeOptions,
): OptimizeResult => {
    const rootPkgJsonPath = join(workspaceRoot, "package.json");
    const lockText = readLockfileText(workspaceRoot, pm.name);
    const entries: OverrideEntry[] = [];
    let skipped = 0;

    for (const [, data] of manifest) {
        if (data.deprecated) {
            continue;
        }

        const inDeps = allDeps.has(data.package);
        const inLockfile = lockText ? lockfileContainsPackage(lockText, data.package, pm.name) : false;

        if (!inDeps && !inLockfile) {
            skipped++;
            continue;
        }

        const major = coerce(data.version)?.major;

        if (major === undefined) {
            continue;
        }

        entries.push({
            original: data.package,
            spec: options.pin ? `npm:${data.name}@${data.version}` : `npm:${data.name}@^${String(major)}`,
        });
    }

    if (options.dryRun || entries.length === 0) {
        return { added: [], entries, skipped, updated: [], workspaces: workspacesWithDeps };
    }

    const result = applyOverrides(workspaceRoot, rootPkgJsonPath, entries, pm);

    return { ...result, entries, skipped, workspaces: workspacesWithDeps };
};
/* eslint-enable sonarjs/cognitive-complexity */

/**
 * `vis optimize` — two-phase dependency optimization.
 *
 * **Phase 1 (e18e):** Scans dependencies against the
 * {@link https://www.npmjs.com/package/module-replacements | module-replacements}
 * manifests to identify packages replaceable with native JS builtins, lighter
 * alternatives, or inline code. Reports suggestions for the user to apply via
 * `npx @e18e/cli migrate`.
 *
 * **Phase 2 (Socket.dev):** Loads the curated
 * {@link https://www.npmjs.com/package/@socketsecurity/registry | @socketsecurity/registry}
 * manifest and writes override/resolution entries for packages that have
 * security-hardened `@socketregistry/*` alternatives.
 *
 * @example
 * ```sh
 * vis optimize              # analyze + apply overrides + install
 * vis optimize --dry-run    # preview without changes
 * vis optimize --pin        # exact override versions instead of ^ranges
 * vis optimize --prod       # production deps only
 * ```
 */
const optimize: Command = {
    description: "Analyze and optimize dependencies using e18e replacements and @socketregistry overrides",
    examples: [
        ["vis optimize", "Analyze with e18e and apply Socket.dev overrides"],
        ["vis optimize --dry-run", "Preview changes without modifying files"],
        ["vis optimize --pin", "Pin overrides to exact versions"],
        ["vis optimize --prod", "Only optimize production dependencies"],
    ],
    execute: async ({ logger, options, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const pm = detectPm(wsRoot);

        info(`Detected ${pm.name} v${pm.version}.`);

        const isDryRun = Boolean(options["dry-run"]);
        const isProd = Boolean(options.prod);

        // Collect all deps across root + workspaces (shared by e18e and socket)
        const rootPkgJsonPath = join(wsRoot, "package.json");
        const rootDeps = collectDepsFromPkgJson(rootPkgJsonPath, isProd);
        const workspaceDirs = discoverWorkspacePackages(wsRoot);
        const allDeps = new Set(rootDeps);
        const workspacesWithDeps: string[] = [];

        for (const wsDir of workspaceDirs) {
            const wsDeps = collectDepsFromPkgJson(join(resolve(wsRoot, wsDir), "package.json"), isProd);

            if (wsDeps.size > 0) {
                for (const dep of wsDeps) {
                    allDeps.add(dep);
                }

                workspacesWithDeps.push(wsDir);
            }
        }

        if (workspacesWithDeps.length > 0) {
            info(`Scanned ${String(workspacesWithDeps.length)} workspace package${workspacesWithDeps.length === 1 ? "" : "s"}.`);
        }

        // ── Phase 1: e18e module-replacements analysis ──────────────
        info("\nAnalyzing dependencies for module replacements (e18e)...");

        const e18eSuggestions = analyzeE18eReplacements(allDeps);

        if (e18eSuggestions.length > 0) {
            const natives = e18eSuggestions.filter((s) => s.category === "native");
            const preferred = e18eSuggestions.filter((s) => s.category === "preferred");
            const micros = e18eSuggestions.filter((s) => s.category === "micro-utility");

            if (natives.length > 0) {
                info(`\n  Native replacements (${String(natives.length)}):`);

                for (const s of natives) {
                    info(`    ${s.packageName} → ${s.replacement}`);
                }
            }

            if (preferred.length > 0) {
                info(`\n  Preferred alternatives (${String(preferred.length)}):`);

                for (const s of preferred) {
                    info(`    ${s.packageName} → ${s.replacement}`);
                }
            }

            if (micros.length > 0) {
                info(`\n  Micro-utilities (${String(micros.length)}):`);

                for (const s of micros) {
                    info(`    ${s.packageName} → ${s.replacement}`);
                }
            }

            note(`\n  Run 'npx @e18e/cli migrate' to apply source code codemods for these replacements.`);
        } else {
            info("  No module replacement suggestions found.");
        }

        // ── Phase 2: Socket.dev security-hardened overrides ─────────
        info("\nLoading @socketregistry manifest...");

        const manifest = (getManifestData("npm") ?? []) as ManifestEntry[];

        if (manifest.length === 0) {
            warn("No registry entries found in @socketsecurity/registry.");
            process.exitCode = 1;

            return;
        }

        info(`Loaded ${String(manifest.length)} registry entries.`);

        const result = executeOptimize(wsRoot, manifest, pm, allDeps, workspacesWithDeps, {
            dryRun: isDryRun,
            pin: Boolean(options.pin),
            prod: isProd,
        });

        if (result.entries.length === 0) {
            info("No additional packages found for @socketregistry overrides.\n");

            return;
        }

        if (isDryRun) {
            info(`Would apply ${String(result.entries.length)} overrides:\n`);

            for (const entry of result.entries) {
                info(`  ${entry.original} → ${entry.spec}`);
            }

            info(`\n  ${String(result.skipped)} packages skipped (not in dependencies).`);

            if (result.workspaces.length > 0) {
                info(`  Scanned across ${String(result.workspaces.length)} workspace${result.workspaces.length === 1 ? "" : "s"}.`);
            }

            note("\nRun without --dry-run to apply changes.");

            return;
        }

        if (options.json) {
            process.stdout.write(
                JSON.stringify(
                    {
                        e18e: {
                            microUtilities: e18eSuggestions.filter((s) => s.category === "micro-utility").length,
                            native: e18eSuggestions.filter((s) => s.category === "native").length,
                            preferred: e18eSuggestions.filter((s) => s.category === "preferred").length,
                            suggestions: e18eSuggestions,
                            total: e18eSuggestions.length,
                        },
                        socket: {
                            added: result.added,
                            entries: result.entries.length,
                            skipped: result.skipped,
                            updated: result.updated,
                        },
                        packageManager: pm.name,
                        workspaces: workspacesWithDeps.length,
                    },
                    undefined,
                    2,
                ) + "\n",
            );

            return;
        }

        if (result.added.length > 0) {
            success(`Added ${String(result.added.length)} override${result.added.length === 1 ? "" : "s"}.`);
        }

        if (result.updated.length > 0) {
            success(`Updated ${String(result.updated.length)} override${result.updated.length === 1 ? "" : "s"}.`);
        }

        if (result.workspaces.length > 0) {
            info(`  Dependencies scanned across ${String(result.workspaces.length)} workspace${result.workspaces.length === 1 ? "" : "s"}.`);
        }

        if (result.added.length === 0 && result.updated.length === 0) {
            info("All applicable overrides are already in place.");

            return;
        }

        if (!options["no-install"]) {
            info(`\nRunning ${pm.name} install to update lockfile...`);

            const code = runInstall(
                pm,
                {
                    dev: false,
                    filter: [],
                    force: false,
                    frozenLockfile: false,
                    ignoreScripts: false,
                    lockfileOnly: false,
                    noOptional: false,
                    offline: false,
                    prod: false,
                    recursive: false,
                    silent: false,
                    workspaceRoot: false,
                },
                wsRoot,
                logger,
            );

            if (code !== 0) {
                warn(`${pm.name} install exited with code ${String(code)}. Run it manually.`);
            }
        }

        info("");
        success("Optimization complete.");
    },
    name: "optimize",
    options: [
        { alias: "d", defaultValue: false, description: "Preview changes without modifying files", name: "dry-run", type: Boolean },
        { defaultValue: false, description: "Pin overrides to exact versions instead of ranges", name: "pin", type: Boolean },
        { defaultValue: false, description: "Only optimize production dependencies", name: "prod", type: Boolean },
        { defaultValue: false, description: "Skip running install after applying overrides", name: "no-install", type: Boolean },
        { defaultValue: false, description: "Output results as JSON", name: "json", type: Boolean },
    ],
};

export default optimize;
