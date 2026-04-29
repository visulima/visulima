import { writeFileSync } from "node:fs";

import { getManifestData } from "@socketsecurity/registry";
import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { glob, isAccessibleSync, readFileSync, readJsonSync } from "@visulima/fs";
import { join, resolve } from "@visulima/path";
import { render } from "@visulima/tui";
import isInCi from "is-in-ci";
import microUtilitiesManifest from "module-replacements/manifests/micro-utilities.json" with { type: "json" };
import nativeManifest from "module-replacements/manifests/native.json" with { type: "json" };
import preferredManifest from "module-replacements/manifests/preferred.json" with { type: "json" };
import React from "react";
import { coerce } from "semver";

import { info, note, success, warn } from "../../output";
import type { OverrideEntry, PmInfo } from "../../overrides";
import { applyOverrides, lockfileContainsPackage, readLockfileText } from "../../overrides";
import { detectPm, runInstall } from "../../pm-runner";
import type { OptimizeEntry } from "../../tui/components/optimize/OptimizeStore";
import { OptimizeStore } from "../../tui/components/optimize/OptimizeStore";
import VisOptimizeApp from "../../tui/components/optimize/VisOptimizeApp";
import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../../workspace";
import type { OptimizeOptions } from "./index";

// ── Types ───────────────────────────────────────────────────────────

interface ManifestEntryData {
    categories?: string[];
    deprecated?: boolean;
    name: string;
    package: string;
    version: string;
}

type ManifestEntry = [string, ManifestEntryData];

interface E18eManifest {
    mappings: Record<string, { moduleName: string; replacements: string[] }>;
    replacements: Record<string, { description?: string; id: string; type: string }>;
}

// ── Dep collection ──────────────────────────────────────────────────

/** Collects dependency names from a `package.json`. */
const collectDepsFromPkgJson = (pkgJsonPath: string, productionOnly: boolean): Set<string> => {
    const deps = new Set<string>();

    try {
        const pkg = readJsonSync(pkgJsonPath) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            optionalDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };

        const maps = productionOnly
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
        // package.json may not exist
    }

    return deps;
};

/** Discovers workspace package directories. */
const discoverWorkspacePackages = (workspaceRoot: string): string[] => {
    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);

    if (pnpmPatterns) {
        return resolveWorkspacePatterns(workspaceRoot, pnpmPatterns);
    }

    const rootPkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(rootPkgPath)) {
        return [];
    }

    try {
        const pkg = readJsonSync(rootPkgPath) as {
            workspaces?: string[] | { packages?: string[] };
        };

        const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages;

        return patterns ? resolveWorkspacePatterns(workspaceRoot, patterns) : [];
    } catch {
        return [];
    }
};

// ── Entry builders ──────────────────────────────────────────────────

/** Scans deps against e18e module-replacements manifests. */
const buildE18eEntries = (allDeps: Set<string>): OptimizeEntry[] => {
    const entries: OptimizeEntry[] = [];

    const scanManifest = (manifest: E18eManifest, category: "micro-utility" | "native" | "preferred"): void => {
        for (const [, mapping] of Object.entries(manifest.mappings)) {
            if (!allDeps.has(mapping.moduleName)) {
                continue;
            }

            const descriptions: string[] = [];

            for (const rid of mapping.replacements) {
                const rep = manifest.replacements[rid];

                if (rep) {
                    descriptions.push(rep.description ?? rep.id);
                }
            }

            entries.push({
                category,
                hasCodemod: false, // filled in below
                overrideSpec: undefined,
                packageName: mapping.moduleName,
                replacement: descriptions.join(", ") || mapping.replacements.join(", "),
            });
        }
    };

    scanManifest(nativeManifest as unknown as E18eManifest, "native");
    scanManifest(preferredManifest as unknown as E18eManifest, "preferred");
    scanManifest(microUtilitiesManifest as unknown as E18eManifest, "micro-utility");

    return entries;
};

/** Scans deps against @socketregistry manifest. */
const buildSocketEntries = (allDeps: Set<string>, lockText: string, pm: PmInfo, pin: boolean): OptimizeEntry[] => {
    const manifest = (getManifestData("npm") ?? []) as ManifestEntry[];
    const entries: OptimizeEntry[] = [];

    for (const [, data] of manifest) {
        if (data.deprecated) {
            continue;
        }

        const inDeps = allDeps.has(data.package);
        const inLockfile = lockText ? lockfileContainsPackage(lockText, data.package, pm.name) : false;

        if (!inDeps && !inLockfile) {
            continue;
        }

        const major = coerce(data.version)?.major;

        if (major === undefined) {
            continue;
        }

        const spec = pin ? `npm:${data.name}@${data.version}` : `npm:${data.name}@^${String(major)}`;

        entries.push({
            category: "socket",
            hasCodemod: false,
            overrideSpec: spec,
            packageName: data.package,
            replacement: data.name,
        });
    }

    return entries;
};

type CodemodFactory = (options: Record<string, never>) => { transform: (options_: { file: { filename: string; source: string } }) => Promise<string> | string };

/** Cached codemods map — loaded once on first use. */
let cachedCodemods: Record<string, CodemodFactory> | undefined;

const loadCodemods = async (): Promise<Record<string, CodemodFactory>> => {
    if (cachedCodemods) {
        return cachedCodemods;
    }

    try {
        const module_ = (await import("module-replacements-codemods")) as { codemods: Record<string, CodemodFactory> };

        cachedCodemods = module_.codemods;

        return cachedCodemods;
    } catch {
        return {};
    }
};

/** Marks e18e entries that have codemods available. */
const markCodemodAvailability = async (entries: OptimizeEntry[]): Promise<void> => {
    try {
        const codemods = await loadCodemods();

        for (const entry of entries) {
            if (entry.category !== "socket" && codemods[entry.packageName]) {
                entry.hasCodemod = true;
            }
        }
    } catch {
        // module-replacements-codemods not installed or failed
    }
};

// ── Codemod execution ───────────────────────────────────────────────

interface CodemodResult {
    filesChanged: number;
    packageName: string;
}

/**
 * Runs a codemod for a single package across all source files in the project.
 * Returns the number of files modified.
 */
const runCodemod = async (workspaceRoot: string, packageName: string): Promise<CodemodResult> => {
    let filesChanged = 0;

    try {
        const codemods = await loadCodemods();
        const factory = codemods[packageName];

        if (!factory) {
            return { filesChanged: 0, packageName };
        }

        const codemod = factory({});
        const sourceFiles = await collectSourceFiles(workspaceRoot);

        for (const filePath of sourceFiles) {
            const source: string = readFileSync(filePath);

            if (!source.includes(packageName)) {
                continue;
            }

            try {
                const result = await codemod.transform({ file: { filename: filePath, source } });

                if (result !== source) {
                    writeFileSync(filePath, result, "utf8");
                    filesChanged++;
                }
            } catch (error) {
                process.stderr.write(`warn: codemod transform failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}\n`);
            }
        }
    } catch {
        // Codemod package not available
    }

    return { filesChanged, packageName };
};

/** Collects .ts/.js/.tsx/.jsx source files, excluding node_modules and dist. */
const collectSourceFiles = async (dir: string): Promise<string[]> =>
    glob("**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}", {
        absolute: true,
        cwd: dir,
        // Matches the hand-rolled walker's SKIP set + "skip dotted
        // entries" policy. `tinyglobby` (the engine) applies these as
        // negative patterns during the walk so skipped subtrees are
        // never descended into.
        ignore: ["**/.*/**", "**/.*", "**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.git/**", "**/.next/**", "**/.nuxt/**"],
    });

const execute = async ({ logger, options, workspaceRoot: wsRoot }: Toolbox<Console, OptimizeOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    const pm = detectPm(wsRoot);
    const isDryRun = Boolean(options.dryRun);
    const isProduction = Boolean(options.prod);
    const isPin = Boolean(options.pin);

    info(`Detected ${pm.name} v${pm.version}.`);

    // Collect all deps
    const rootDeps = collectDepsFromPkgJson(join(wsRoot, "package.json"), isProduction);
    const workspaceDirectories = discoverWorkspacePackages(wsRoot);
    const allDeps = new Set(rootDeps);

    for (const wsDir of workspaceDirectories) {
        const wsDeps = collectDepsFromPkgJson(join(resolve(wsRoot, wsDir), "package.json"), isProduction);

        for (const dep of wsDeps) {
            allDeps.add(dep);
        }
    }

    if (workspaceDirectories.length > 0) {
        info(`Scanned ${String(workspaceDirectories.length)} workspace package${workspaceDirectories.length === 1 ? "" : "s"}.`);
    }

    // Build entries from both sources
    info("Scanning dependencies...\n");

    const lockText = readLockfileText(wsRoot, pm.name);
    const e18eEntries = buildE18eEntries(allDeps);
    const socketEntries = buildSocketEntries(allDeps, lockText, pm, isPin);

    // Deduplicate: if a package appears in both, prefer e18e (source-level fix is better than override)
    const e18ePackages = new Set(e18eEntries.map((e) => e.packageName));
    const dedupedSocketEntries = socketEntries.filter((e) => !e18ePackages.has(e.packageName));

    const allEntries = [...e18eEntries, ...dedupedSocketEntries];

    await markCodemodAvailability(allEntries);

    if (allEntries.length === 0) {
        info("No optimizations found for your dependencies.");

        return;
    }

    // Interactive TUI mode
    const isTTY = Boolean(process.stdout.isTTY) && !isInCi;

    const isJson = options.format === "json" || Boolean((options as Record<string, unknown>).json);

    if (isTTY && !isDryRun && !isJson) {
        const store = new OptimizeStore(allEntries);

        const instance = render(React.createElement(VisOptimizeApp, { isDryRun: false, store }), {
            alternateScreen: true,
            exitOnCtrlC: false,
            interactive: true,
            patchConsole: true,
        });

        const exitResult = await instance.waitUntilExit();

        const selected = Array.isArray(exitResult) ? (exitResult as OptimizeEntry[]) : [];

        if (selected.length === 0) {
            info("No optimizations selected.");

            return;
        }

        // Apply selected optimizations
        const selectedE18eWithCodemod = selected.filter((e) => e.category !== "socket" && e.hasCodemod);
        const selectedE18eManual = selected.filter((e) => e.category !== "socket" && !e.hasCodemod);
        const selectedSocket = selected.filter((e) => e.category === "socket");

        // Phase 1: Run codemods
        if (selectedE18eWithCodemod.length > 0) {
            info(`\nRunning ${String(selectedE18eWithCodemod.length)} codemod${selectedE18eWithCodemod.length === 1 ? "" : "s"}...\n`);

            for (const entry of selectedE18eWithCodemod) {
                const result = await runCodemod(wsRoot, entry.packageName);

                if (result.filesChanged > 0) {
                    success(`  ${entry.packageName}: ${String(result.filesChanged)} file${result.filesChanged === 1 ? "" : "s"} updated`);
                } else {
                    info(`  ${entry.packageName}: no files changed`);
                }
            }
        }

        // Report e18e entries that need manual migration
        if (selectedE18eManual.length > 0) {
            warn(
                `\n${String(selectedE18eManual.length)} selected replacement${selectedE18eManual.length === 1 ? "" : "s"} require manual migration (no codemod available):`,
            );

            for (const entry of selectedE18eManual) {
                info(`  ${entry.packageName} → ${entry.replacement}`);
            }

            note("  Replace usage in your source code, then remove from dependencies.");
        }

        // Phase 2: Write overrides
        if (selectedSocket.length > 0) {
            const overrideEntries: OverrideEntry[] = selectedSocket
                .filter((e) => e.overrideSpec)
                .map((e) => {
                    return { original: e.packageName, spec: e.overrideSpec! };
                });

            const result = applyOverrides(wsRoot, join(wsRoot, "package.json"), overrideEntries, pm);

            if (result.added.length > 0) {
                success(`\nAdded ${String(result.added.length)} override${result.added.length === 1 ? "" : "s"}.`);
            }

            if (result.updated.length > 0) {
                success(`Updated ${String(result.updated.length)} override${result.updated.length === 1 ? "" : "s"}.`);
            }
        }

        // Run install
        if (selectedSocket.length > 0 && !options.noInstall) {
            info(`\nRunning ${pm.name} install to update lockfile...`);

            const installOptions = {
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
            };

            const code = runInstall(pm, installOptions, wsRoot, logger);

            if (code !== 0) {
                warn(`${pm.name} install exited with code ${String(code)}. Run it manually.`);
            }
        }

        info("");
        success("Optimization complete.");

        return;
    }

    // Static output (non-TTY, CI, dry-run, JSON)
    if (isJson) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    e18e: e18eEntries.map((e) => {
                        return {
                            category: e.category,
                            hasCodemod: e.hasCodemod,
                            packageName: e.packageName,
                            replacement: e.replacement,
                        };
                    }),
                    packageManager: pm.name,
                    socket: dedupedSocketEntries.map((e) => {
                        return { overrideSpec: e.overrideSpec, packageName: e.packageName, replacement: e.replacement };
                    }),
                    total: allEntries.length,
                    workspaces: workspaceDirectories.length,
                },
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    // Static text output
    const natives = e18eEntries.filter((e) => e.category === "native");
    const preferred = e18eEntries.filter((e) => e.category === "preferred");
    const micros = e18eEntries.filter((e) => e.category === "micro-utility");

    if (natives.length > 0) {
        info(`Native replacements (${String(natives.length)}):`);

        for (const s of natives) {
            info(`  ${s.hasCodemod ? "⚙" : " "} ${s.packageName} → ${s.replacement}`);
        }
    }

    if (preferred.length > 0) {
        info(`\nPreferred alternatives (${String(preferred.length)}):`);

        for (const s of preferred) {
            info(`  ${s.hasCodemod ? "⚙" : " "} ${s.packageName} → ${s.replacement}`);
        }
    }

    if (micros.length > 0) {
        info(`\nMicro-utilities (${String(micros.length)}):`);

        for (const s of micros) {
            info(`  ${s.hasCodemod ? "⚙" : " "} ${s.packageName} → ${s.replacement}`);
        }
    }

    if (dedupedSocketEntries.length > 0) {
        info(`\nSocket.dev overrides (${String(dedupedSocketEntries.length)}):`);

        for (const s of dedupedSocketEntries) {
            info(`  ${s.packageName} → ${s.overrideSpec}`);
        }
    }

    info(`\nTotal: ${String(allEntries.length)} optimizations available (⚙ = codemod available).`);

    if (isDryRun) {
        note("Run without --dry-run for interactive selection.");
    }
};

export default execute as CommandExecute<Toolbox>;
export { buildE18eEntries, buildSocketEntries, collectDepsFromPkgJson, discoverWorkspacePackages, markCodemodAvailability, runCodemod };
