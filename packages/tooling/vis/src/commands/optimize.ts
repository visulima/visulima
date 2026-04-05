import { existsSync, readFileSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { getManifestData } from "@socketsecurity/registry";
import { join, resolve } from "@visulima/path";
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
const executeOptimize = (workspaceRoot: string, manifest: ManifestEntry[], pm: PmInfo, options: OptimizeOptions): OptimizeResult => {
    const rootPkgJsonPath = join(workspaceRoot, "package.json");
    const rootDeps = collectDepsFromPkgJson(rootPkgJsonPath, options.prod);

    const workspaceDirs = discoverWorkspacePackages(workspaceRoot);
    const allDeps = new Set(rootDeps);
    const workspacesWithDeps: string[] = [];

    for (const wsDir of workspaceDirs) {
        const wsDeps = collectDepsFromPkgJson(join(resolve(workspaceRoot, wsDir), "package.json"), options.prod);

        if (wsDeps.size > 0) {
            for (const dep of wsDeps) {
                allDeps.add(dep);
            }

            workspacesWithDeps.push(wsDir);
        }
    }

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
 * `vis optimize` — replace dependencies with security-hardened `@socketregistry` alternatives.
 *
 * Loads the curated {@link https://www.npmjs.com/package/@socketsecurity/registry | @socketsecurity/registry}
 * manifest, identifies packages in the dependency tree that have hardened replacements,
 * and writes the appropriate override/resolution entries for the detected package manager.
 *
 * @example
 * ```sh
 * vis optimize              # apply overrides and run install
 * vis optimize --dry-run    # preview without changes
 * vis optimize --pin        # exact versions instead of ^ranges
 * vis optimize --prod       # production deps only
 * ```
 */
const optimize: Command = {
    description: "Optimize dependencies with @socketregistry security-hardened overrides",
    examples: [
        ["vis optimize", "Apply Socket.dev registry overrides"],
        ["vis optimize --dry-run", "Preview changes without modifying files"],
        ["vis optimize --pin", "Pin overrides to exact versions"],
        ["vis optimize --prod", "Only optimize production dependencies"],
    ],
    execute: async ({ logger, options, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        const pm = detectPm(wsRoot);

        info("Loading @socketregistry manifest...");

        const manifest = (getManifestData("npm") ?? []) as ManifestEntry[];

        if (manifest.length === 0) {
            warn("No registry entries found in @socketsecurity/registry.");
            process.exitCode = 1;

            return;
        }

        info(`Loaded ${String(manifest.length)} registry entries.`);
        info(`Detected ${pm.name} v${pm.version}.`);

        const isDryRun = Boolean(options["dry-run"]);

        const result = executeOptimize(wsRoot, manifest, pm, {
            dryRun: isDryRun,
            pin: Boolean(options.pin),
            prod: Boolean(options.prod),
        });

        if (result.workspaces.length > 0) {
            info(`Scanned ${String(result.workspaces.length)} workspace package${result.workspaces.length === 1 ? "" : "s"}.\n`);
        } else {
            info("");
        }

        if (result.entries.length === 0) {
            info("No packages found that can be optimized with @socketregistry overrides.");

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
                        added: result.added,
                        entries: result.entries.length,
                        packageManager: pm.name,
                        skipped: result.skipped,
                        updated: result.updated,
                        workspaces: result.workspaces.length,
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
