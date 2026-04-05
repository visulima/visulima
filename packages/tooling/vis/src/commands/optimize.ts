import { readFileSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { join } from "@visulima/path";
import { coerce } from "semver";

import { info, note, success, warn } from "../output";
import type { OverrideEntry } from "../overrides";
import { applyOverrides, lockfileContainsPackage, readLockfileText } from "../overrides";
import { detectPm, runInstall } from "../pm-runner";

// ── Types ───────────────────────────────────────────────────────────

interface ManifestEntryData {
    categories?: string[];
    deprecated?: boolean;
    name: string;
    package: string;
    version: string;
}

type ManifestEntry = [string, ManifestEntryData];

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

const collectDirectDeps = (workspaceRoot: string): Set<string> => {
    const pkgJsonPath = join(workspaceRoot, "package.json");
    const deps = new Set<string>();

    try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            optionalDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };

        for (const depMap of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies]) {
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

interface OptimizeOptions {
    dryRun: boolean;
    pin: boolean;
    prod: boolean;
}

/* eslint-disable sonarjs/cognitive-complexity -- optimize command with multiple flows */
const executeOptimize = (
    workspaceRoot: string,
    manifest: ManifestEntry[],
    pm: { name: "bun" | "npm" | "pnpm" | "yarn"; version: string },
    options: OptimizeOptions,
    logger: Console,
): { added: string[]; entries: OverrideEntry[]; skipped: number; updated: string[] } => {
    const directDeps = collectDirectDeps(workspaceRoot);
    const lockText = readLockfileText(workspaceRoot, pm.name);
    const entries: OverrideEntry[] = [];
    let skipped = 0;

    for (const [, data] of manifest) {
        if (data.deprecated) {
            continue;
        }

        const origPkg = data.package;
        const registryName = data.name;

        // Skip if the original package isn't in deps or lockfile
        const inDeps = directDeps.has(origPkg);
        const inLockfile = lockText ? lockfileContainsPackage(lockText, origPkg, pm.name) : false;

        if (!inDeps && !inLockfile) {
            skipped++;
            continue;
        }

        // Skip dev-only deps in prod mode
        if (options.prod && !inDeps) {
            skipped++;
            continue;
        }

        // Build the override spec
        const major = coerce(data.version)?.major;

        if (major === undefined) {
            continue;
        }

        const spec = options.pin ? `npm:${registryName}@${data.version}` : `npm:${registryName}@^${String(major)}`;

        entries.push({ original: origPkg, spec });
    }

    if (options.dryRun || entries.length === 0) {
        return { added: [], entries, skipped, updated: [] };
    }

    const pkgJsonPath = join(workspaceRoot, "package.json");
    const result = applyOverrides(pkgJsonPath, entries, pm.name);

    return { ...result, entries, skipped };
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

        // Load @socketregistry manifest
        info("Loading @socketregistry manifest...");

        const manifest = await loadManifest();

        if (manifest.length === 0) {
            warn("Could not load @socketregistry manifest. Install @socketsecurity/registry:");
            note("  pnpm add -D @socketsecurity/registry");
            process.exitCode = 1;

            return;
        }

        info(`Loaded ${String(manifest.length)} registry entries.`);
        info(`Detected ${pm.name} v${pm.version}.\n`);

        const isDryRun = Boolean(options["dry-run"]);
        const isProd = Boolean(options.prod);
        const isPin = Boolean(options.pin);

        // Run the optimization
        const result = executeOptimize(wsRoot, manifest, pm, { dryRun: isDryRun, pin: isPin, prod: isProd }, logger);

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

        if (result.added.length === 0 && result.updated.length === 0) {
            info("All applicable overrides are already in place.");

            return;
        }

        // Run install to regenerate lockfile
        if (!options["no-install"]) {
            info(`\nRunning ${pm.name} install to update lockfile...`);

            const code = runInstall(pm, { dev: false, filter: [], force: false, frozenLockfile: false, ignoreScripts: false, lockfileOnly: false, noOptional: false, offline: false, prod: false, recursive: false, silent: false, workspaceRoot: false }, wsRoot, logger);

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
