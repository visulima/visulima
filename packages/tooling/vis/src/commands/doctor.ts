import type { Command } from "@visulima/cerebro";
import colorize from "@visulima/colorize";

const { dim, green, red, yellow } = colorize;
import { findPackageManagerSync } from "@visulima/package";
import { join, resolve } from "@visulima/path";

import type { CatalogCheckOptions, OutdatedEntry } from "../catalog";
import { checkOutdated, fetchVulnerabilities, loadNpmrc, readCatalogs } from "../catalog";
import { error as errorOutput, info, note, success } from "../output";
import { applyOverrides, readLockfileText } from "../overrides";
import { detectPm, runInstall } from "../pm-runner";
import { checkRuntimeVersions } from "../runtime-check";
import { buildSocketOptions, DEFAULT_LOW_SCORE_THRESHOLD, fetchSocketReports } from "../socket-security";
import type { OptimizeEntry } from "../tui/components/optimize/OptimizeStore";
import type { VisConfig } from "../workspace";
import type { DuplicatePackage } from "./audit";
import { findDuplicateDependencies, scanInstalledPackages } from "./audit";
import { buildE18eEntries, buildSocketEntries, collectDepsFromPkgJson, discoverWorkspacePackages, markCodemodAvailability, runCodemod } from "./optimize";

// ── Types ───────────────────────────────────────────────────────────

interface DoctorResults {
    duplicates: DuplicatePackage[];
    installedCount: number;
    optimizations: OptimizeEntry[];
    outdated: OutdatedEntry[];
    socketIssues: { alerts: number; lowScore: number };
    vulnCount: number;
    workspaceCount: number;
}

// ── Scan orchestration ──────────────────────────────────────────────

/**
 * Runs all diagnostic scans in parallel and returns a unified result.
 * @param workspaceRoot Absolute path to the workspace root.
 * @param visConfig Loaded vis configuration (may be undefined if no config file).
 * @param resolveCodemods When true, checks which e18e entries have codemods available (adds latency).
 * @returns Aggregated results including outdated, vulns, duplicates, and optimization counts.
 */
const runAllScans = async (workspaceRoot: string, visConfig: VisConfig | undefined, resolveCodemods: boolean = false): Promise<DoctorResults> => {
    const pm = detectPm(workspaceRoot);
    const { packageManager } = findPackageManagerSync(workspaceRoot);

    // Collect deps across workspaces (shared by outdated + optimize scans)
    const rootDeps = collectDepsFromPkgJson(join(workspaceRoot, "package.json"), false);
    const workspaceDirectories = discoverWorkspacePackages(workspaceRoot);
    const allDeps = new Set(rootDeps);

    for (const wsDir of workspaceDirectories) {
        const wsDeps = collectDepsFromPkgJson(join(resolve(workspaceRoot, wsDir), "package.json"), false);

        for (const dep of wsDeps) {
            allDeps.add(dep);
        }
    }

    // Build scan config
    const npmrcConfig = loadNpmrc(workspaceRoot);
    const catalogs = readCatalogs(workspaceRoot, packageManager);
    const socketOptions = buildSocketOptions(visConfig?.security?.socket);
    const acceptedRisks = visConfig?.security?.socket?.acceptedRisks;
    const lockText = readLockfileText(workspaceRoot, pm.name);

    const checkOptions: CatalogCheckOptions = {
        exclude: [],
        ignore: [],
        include: [],
        includeLocked: false,
        includePrerelease: false,
        security: true,
        target: "latest",
    };

    // Run all scans in parallel
    // `findDuplicateDependencies` is synchronous — hoist it out of Promise.all
    // so `await Promise.all` doesn't flag it (await-thenable).
    const duplicates = findDuplicateDependencies(workspaceRoot, pm.name);
    const [outdatedResult, installed, e18eEntries, socketEntries] = await Promise.all([
        catalogs.size > 0
            ? checkOutdated(catalogs, checkOptions, npmrcConfig, undefined, workspaceRoot, socketOptions, acceptedRisks)
            : Promise.resolve({ failed: [], ignored: [], outdated: [] }),
        Promise.resolve(scanInstalledPackages(workspaceRoot)),
        Promise.resolve(buildE18eEntries(allDeps)),
        Promise.resolve(buildSocketEntries(allDeps, lockText, pm, false)),
    ]);

    // Deduplicate: e18e preferred over socket
    const e18eNames = new Set(e18eEntries.map((e) => e.packageName));
    const dedupedSocket = socketEntries.filter((e) => !e18eNames.has(e.packageName));
    const allOptimizations = [...e18eEntries, ...dedupedSocket];

    if (resolveCodemods) {
        await markCodemodAvailability(allOptimizations);
    }

    // Count Socket.dev issues from installed packages
    let socketAlerts = 0;
    let socketLowScore = 0;

    if (socketOptions && installed.length > 0) {
        const reports = await fetchSocketReports(
            installed.map((p) => {
                return { name: p.name, version: p.version };
            }),
            socketOptions,
        );

        for (const report of reports.values()) {
            if (report.alerts.length > 0) {
                socketAlerts += report.alerts.length;
            }

            if (report.score.overall < DEFAULT_LOW_SCORE_THRESHOLD) {
                socketLowScore++;
            }
        }
    }

    // Count vulnerabilities from both outdated entries and installed packages
    let vulnCount = 0;

    for (const entry of outdatedResult.outdated) {
        if (entry.vulnerabilities && entry.vulnerabilities.length > 0) {
            vulnCount += entry.vulnerabilities.length;
        }
    }

    // Also scan installed packages for known vulnerabilities (catches advisory-only CVEs)
    if (installed.length > 0) {
        const vulnMap = await fetchVulnerabilities(
            installed.map((p) => {
                return { name: p.name, version: p.version };
            }),
        );

        for (const vulns of vulnMap.values()) {
            vulnCount += vulns.length;
        }
    }

    return {
        duplicates,
        installedCount: installed.length,
        optimizations: allOptimizations,
        outdated: outdatedResult.outdated,
        socketIssues: { alerts: socketAlerts, lowScore: socketLowScore },
        vulnCount,
        workspaceCount: workspaceDirectories.length,
    };
};

// ── Display ─────────────────────────────────────────────────────────

/** Returns a colored checkmark (ok) or cross (not ok). */
const icon = (ok: boolean): string => (ok ? green("\u2713") : red("\u2717"));
const warnIcon = yellow("\u26A0");

const displayResults = (results: DoctorResults): void => {
    const { duplicates, installedCount, optimizations, outdated, socketIssues, vulnCount } = results;

    info("");

    // Dependencies section
    info(
        dim(
            "\u2500\u2500 Dependencies \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
        ),
    );
    info(`  ${icon(true)} ${String(installedCount)} packages installed`);

    if (outdated.length > 0) {
        const majors = outdated.filter((e) => e.updateType === "major").length;
        const minors = outdated.filter((e) => e.updateType === "minor").length;
        const patches = outdated.filter((e) => e.updateType === "patch").length;
        const parts: string[] = [];

        if (majors > 0) {
            parts.push(`${String(majors)} major`);
        }

        if (minors > 0) {
            parts.push(`${String(minors)} minor`);
        }

        if (patches > 0) {
            parts.push(`${String(patches)} patch`);
        }

        info(`  ${warnIcon} ${String(outdated.length)} outdated (${parts.join(", ")})`);
    } else {
        info(`  ${icon(true)} All dependencies up to date`);
    }

    if (duplicates.length > 0) {
        info(`  ${warnIcon} ${String(duplicates.length)} packages with duplicate versions`);
    } else {
        info(`  ${icon(true)} No duplicate dependencies`);
    }

    // Security section
    info("");
    info(
        dim(
            "\u2500\u2500 Security \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
        ),
    );

    if (vulnCount > 0) {
        info(`  ${icon(false)} ${String(vulnCount)} vulnerabilit${vulnCount === 1 ? "y" : "ies"} found`);
    } else {
        info(`  ${icon(true)} No known vulnerabilities`);
    }

    if (socketIssues.alerts > 0) {
        info(`  ${warnIcon} ${String(socketIssues.alerts)} Socket.dev security alert${socketIssues.alerts === 1 ? "" : "s"}`);
    }

    if (socketIssues.lowScore > 0) {
        info(`  ${warnIcon} ${String(socketIssues.lowScore)} package${socketIssues.lowScore === 1 ? "" : "s"} with low security score`);
    }

    if (socketIssues.alerts === 0 && socketIssues.lowScore === 0 && vulnCount === 0) {
        info(`  ${icon(true)} No security issues detected`);
    }

    // Optimization section
    info("");
    info(
        dim(
            "\u2500\u2500 Optimization \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
        ),
    );

    let natives = 0;
    let preferred = 0;
    let micros = 0;
    let socketOverrides = 0;

    for (const o of optimizations) {
        switch (o.category) {
            case "micro-utility": {
                micros++;
                break;
            }
            case "native": {
                natives++;
                break;
            }
            case "preferred": {
                preferred++;
                break;
            }
            case "socket": {
                {
                    socketOverrides++;
                    // No default
                }
                break;
            }
        }
    }

    if (optimizations.length > 0) {
        if (natives > 0) {
            info(`  ${warnIcon} ${String(natives)} replaceable with native APIs`);
        }

        if (preferred > 0) {
            info(`  ${warnIcon} ${String(preferred)} with lighter alternatives`);
        }

        if (micros > 0) {
            info(`  ${warnIcon} ${String(micros)} trivial micro-utilities`);
        }

        if (socketOverrides > 0) {
            info(`  ${warnIcon} ${String(socketOverrides)} @socketregistry overrides available`);
        }
    } else {
        info(`  ${icon(true)} No optimizations available`);
    }

    // Summary
    info("");
    info(
        dim(
            "\u2500\u2500 Summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
        ),
    );

    const criticalCount = vulnCount;
    const improvementCount = outdated.length + duplicates.length + optimizations.length;

    if (criticalCount === 0 && improvementCount === 0) {
        success("  Everything looks good!");
    } else {
        if (criticalCount > 0) {
            errorOutput(`  ${String(criticalCount)} security issue${criticalCount === 1 ? "" : "s"}`);
        }

        if (improvementCount > 0) {
            info(`  ${String(improvementCount)} improvement${improvementCount === 1 ? "" : "s"} available`);
        }
    }
};

const displayActions = (results: DoctorResults): void => {
    const actions: string[] = [];

    if (results.outdated.length > 0) {
        actions.push("vis update     — update outdated dependencies");
    }

    if (results.vulnCount > 0 || results.socketIssues.alerts > 0) {
        actions.push("vis audit      — detailed security analysis");
    }

    if (results.optimizations.length > 0) {
        actions.push("vis optimize   — apply optimizations interactively");
    }

    if (results.duplicates.length > 0) {
        actions.push("vis dedupe     — reduce duplicate versions");
    }

    if (actions.length > 0) {
        info("");
        note("  Next steps:");

        for (const action of actions) {
            note(`    ${action}`);
        }
    }

    info("");
};

// ── Command ─────────────────────────────────────────────────────────

/**
 * `vis doctor` — unified project health check.
 *
 * Runs all diagnostic scans in parallel (outdated, vulnerabilities,
 * Socket.dev scores, duplicates, optimization opportunities) and
 * displays a single dashboard with actionable next steps.
 * @example
 * ```sh
 * vis doctor           # full health check
 * vis doctor --json    # machine-readable output
 * ```
 */
const doctor: Command = {
    description: "Run a full project health check (outdated, security, duplicates, optimizations)",
    examples: [
        ["vis doctor", "Full project health check"],
        ["vis doctor --fix", "Check and auto-apply safe fixes"],
        ["vis doctor --format json", "Machine-readable output for CI"],
        ["vis doctor --exit-code", "Exit with code 1 if security issues found"],
        ["vis doctor --exit-code --strict", "Fail on any issue (outdated, duplicates, security)"],
    ],
    execute: async ({ logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root.");
        }

        const pm = detectPm(wsRoot);

        info(`\n  ${dim("VIS DOCTOR")} — project health check\n`);
        info(`  ${icon(true)} Detected ${pm.name} v${pm.version}`);

        const workspaceDirectories = discoverWorkspacePackages(wsRoot);

        if (workspaceDirectories.length > 0) {
            info(`  ${icon(true)} ${String(workspaceDirectories.length)} workspace package${workspaceDirectories.length === 1 ? "" : "s"}`);
        }

        // Runtime version sanity check (Node, .nvmrc, packageManager field).
        const runtimeFindings = checkRuntimeVersions(wsRoot);

        if (runtimeFindings.length === 0) {
            info(`  ${icon(true)} Runtime: Node.js ${process.versions.node} ${green("✓")}`);
        } else {
            for (const finding of runtimeFindings) {
                const colour = finding.severity === "error" ? red : yellow;

                info(`  ${icon(false)} Runtime: ${colour(finding.message)}`);
            }
        }

        info(`\n  Scanning...`);

        const results = await runAllScans(wsRoot, visConfig, Boolean(options.fix));

        // Pre-compute optimization counts (used by both JSON and display)
        let optNative = 0;
        let optPreferred = 0;
        let optMicro = 0;
        let optSocket = 0;

        for (const o of results.optimizations) {
            switch (o.category) {
                case "micro-utility": {
                    optMicro++;
                    break;
                }
                case "native": {
                    optNative++;
                    break;
                }
                case "preferred": {
                    optPreferred++;
                    break;
                }
                case "socket": {
                    {
                        optSocket++;
                        // No default
                    }
                    break;
                }
            }
        }

        // JSON output
        if ((options.format as string) === "json" || options.json) {
            process.stdout.write(
                `${JSON.stringify(
                    {
                        dependencies: {
                            duplicates: results.duplicates.length,
                            installed: results.installedCount,
                            outdated: results.outdated.length,
                        },
                        optimizations: {
                            microUtilities: optMicro,
                            native: optNative,
                            preferred: optPreferred,
                            socket: optSocket,
                            total: results.optimizations.length,
                        },
                        packageManager: pm.name,
                        security: {
                            alerts: results.socketIssues.alerts,
                            lowScorePackages: results.socketIssues.lowScore,
                            vulnerabilities: results.vulnCount,
                        },
                        workspaces: results.workspaceCount,
                    },
                    undefined,
                    2,
                )}\n`,
            );

            if (options.exitCode && (results.vulnCount > 0 || results.socketIssues.alerts > 0)) {
                process.exitCode = 1;
            }

            return;
        }

        displayResults(results);

        // --fix: auto-remediate by running optimize (codemods + overrides + install)
        if (options.fix && results.optimizations.length > 0) {
            info("");
            info("Applying fixes...\n");

            const socketEntries = results.optimizations
                .filter((o) => o.category === "socket" && o.overrideSpec)
                .map((o) => {
                    return { original: o.packageName, spec: o.overrideSpec! };
                });

            if (socketEntries.length > 0) {
                const overrideResult = applyOverrides(wsRoot, join(wsRoot, "package.json"), socketEntries, pm);

                if (overrideResult.added.length > 0) {
                    success(`  Added ${String(overrideResult.added.length)} security override${overrideResult.added.length === 1 ? "" : "s"}.`);
                }

                if (overrideResult.updated.length > 0) {
                    success(`  Updated ${String(overrideResult.updated.length)} override${overrideResult.updated.length === 1 ? "" : "s"}.`);
                }
            }

            const codemodEntries = results.optimizations.filter((o) => o.category !== "socket" && o.hasCodemod);

            for (const entry of codemodEntries) {
                const codemodResult = await runCodemod(wsRoot, entry.packageName);

                if (codemodResult.filesChanged > 0) {
                    success(`  ${entry.packageName}: ${String(codemodResult.filesChanged)} file${codemodResult.filesChanged === 1 ? "" : "s"} updated`);
                }
            }

            if (socketEntries.length > 0) {
                info(`\n  Running ${pm.name} install to update lockfile...`);

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

                runInstall(pm, installOptions, wsRoot, logger);
            }

            info("");
            success("Fixes applied.");
        } else {
            displayActions(results);
        }

        if (options.exitCode) {
            const hasIssues = options.strict
                ? results.vulnCount > 0 || results.socketIssues.alerts > 0 || results.outdated.length > 0 || results.duplicates.length > 0
                : results.vulnCount > 0 || results.socketIssues.alerts > 0;

            if (hasIssues) {
                process.exitCode = 1;
            }
        }
    },
    group: "Security & Health",
    name: "doctor",
    options: [
        { description: "Output format: table or json (default: table)", name: "format", type: String },
        { defaultValue: false, description: "Exit with code 1 if issues found", name: "exit-code", type: Boolean },
        { defaultValue: false, description: "Auto-apply safe fixes (security overrides + codemods)", name: "fix", type: Boolean },
        { defaultValue: false, description: "With --exit-code: also fail on outdated and duplicate deps", name: "strict", type: Boolean },
    ],
};

export default doctor;
