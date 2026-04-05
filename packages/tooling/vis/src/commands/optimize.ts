import { existsSync, readFileSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { join, resolve } from "@visulima/path";
import { coerce } from "semver";

import { info, note, success, warn } from "../output";
import type { OverrideEntry } from "../overrides";
import { applyOverrides, lockfileContainsPackage, readLockfileText } from "../overrides";
import { detectPm, runInstall } from "../pm-runner";
import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../workspace";

// ── Types ───────────────────────────────────────────────────────────

interface ManifestEntryData {
    categories?: string[];
    deprecated?: boolean;
    name: string;
    package: string;
    version: string;
}

type ManifestEntry = [string, ManifestEntryData];

interface OptimizeOptions {
    dryRun: boolean;
    pin: boolean;
    prod: boolean;
}

interface OptimizeResult {
    added: string[];
    entries: OverrideEntry[];
    skipped: number;
    updated: string[];
    /** Workspace directories that contributed overrides. */
    workspaces: string[];
}

// ── Core logic ──────────────────────────────────────────────────────

const loadManifest = async (): Promise<ManifestEntry[]> => {
    try {
        const { getManifestData } = (await import("@socketsecurity/registry")) as {
            getManifestData: (ecosystem: string) => ManifestEntry[] | undefined;
        };

        return getManifestData("npm") ?? [];
    } catch {
        return [];
    }
};

/**
 * Collects all dependency names from a package.json file.
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
        // Non-critical
    }

    return deps;
};

/**
 * Discovers workspace package directories from the workspace root.
 */
const discoverWorkspacePackages = (workspaceRoot: string): string[] => {
    // Try pnpm-workspace.yaml first
    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);

    if (pnpmPatterns) {
        return resolveWorkspacePatterns(workspaceRoot, pnpmPatterns);
    }

    // Try package.json workspaces field
    const rootPkgPath = join(workspaceRoot, "package.json");

    if (!existsSync(rootPkgPath)) {
        return [];
    }

    try {
        const pkg = JSON.parse(readFileSync(rootPkgPath, "utf8")) as {
            workspaces?: string[] | { packages?: string[] };
        };

        let patterns: string[] | undefined;

        if (Array.isArray(pkg.workspaces)) {
            patterns = pkg.workspaces;
        } else if (pkg.workspaces?.packages) {
            patterns = pkg.workspaces.packages;
        }

        if (patterns) {
            return resolveWorkspacePatterns(workspaceRoot, patterns);
        }
    } catch {
        // Non-critical
    }

    return [];
};

/* eslint-disable sonarjs/cognitive-complexity -- optimize command with multiple flows */
const executeOptimize = (
    workspaceRoot: string,
    manifest: ManifestEntry[],
    pm: { name: "bun" | "npm" | "pnpm" | "yarn"; version: string },
    options: OptimizeOptions,
): OptimizeResult => {
    // Collect deps from root
    const rootPkgJsonPath = join(workspaceRoot, "package.json");
    const rootDeps = collectDepsFromPkgJson(rootPkgJsonPath, options.prod);

    // Collect deps from all workspace packages
    const workspaceDirs = discoverWorkspacePackages(workspaceRoot);
    const allDeps = new Set(rootDeps);
    const workspacesWithDeps: string[] = [];

    for (const wsDir of workspaceDirs) {
        const wsFullPath = resolve(workspaceRoot, wsDir);
        const wsPkgJsonPath = join(wsFullPath, "package.json");
        const wsDeps = collectDepsFromPkgJson(wsPkgJsonPath, options.prod);

        if (wsDeps.size > 0) {
            for (const dep of wsDeps) {
                allDeps.add(dep);
            }

            workspacesWithDeps.push(wsDir);
        }
    }

    // Read lockfile for transitive dep scanning
    const lockText = readLockfileText(workspaceRoot, pm.name);

    // Build override entries from manifest
    const entries: OverrideEntry[] = [];
    let skipped = 0;

    for (const [, data] of manifest) {
        if (data.deprecated) {
            continue;
        }

        const origPkg = data.package;
        const registryName = data.name;

        const inDeps = allDeps.has(origPkg);
        const inLockfile = lockText ? lockfileContainsPackage(lockText, origPkg, pm.name) : false;

        if (!inDeps && !inLockfile) {
            skipped++;
            continue;
        }

        const major = coerce(data.version)?.major;

        if (major === undefined) {
            continue;
        }

        const spec = options.pin ? `npm:${registryName}@${data.version}` : `npm:${registryName}@^${String(major)}`;

        entries.push({ original: origPkg, spec });
    }

    if (options.dryRun || entries.length === 0) {
        return { added: [], entries, skipped, updated: [], workspaces: workspacesWithDeps };
    }

    // Apply overrides at the root level (overrides/resolutions are root-level config)
    const result = applyOverrides(rootPkgJsonPath, entries, pm.name);

    return { ...result, entries, skipped, workspaces: workspacesWithDeps };
};
/* eslint-enable sonarjs/cognitive-complexity */

// ── Command ─────────────────────────────────────────────────────────

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

        const manifest = await loadManifest();

        if (manifest.length === 0) {
            warn("Could not load @socketregistry manifest. Install @socketsecurity/registry:");
            note("  pnpm add -D @socketsecurity/registry");
            process.exitCode = 1;

            return;
        }

        info(`Loaded ${String(manifest.length)} registry entries.`);
        info(`Detected ${pm.name} v${pm.version}.`);

        const isDryRun = Boolean(options["dry-run"]);
        const isProd = Boolean(options.prod);
        const isPin = Boolean(options.pin);

        const result = executeOptimize(wsRoot, manifest, pm, { dryRun: isDryRun, pin: isPin, prod: isProd });

        if (result.workspaces.length > 0) {
            info(`Scanned ${String(result.workspaces.length)} workspace package${result.workspaces.length === 1 ? "" : "s"}.\n`);
        } else {
            info("");
        }

        if (result.entries.length === 0) {
            info("No packages found that can be optimized with @socketregistry overrides.");

            return;
        }

        // Dry-run output
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

        // JSON output
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

        // Summary output
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

        // Run install to regenerate lockfile
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
        {
            alias: "d",
            defaultValue: false,
            description: "Preview changes without modifying files",
            name: "dry-run",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Pin overrides to exact versions instead of ranges",
            name: "pin",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Only optimize production dependencies",
            name: "prod",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip running install after applying overrides",
            name: "no-install",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Output results as JSON",
            name: "json",
            type: Boolean,
        },
    ],
};

export default optimize;
