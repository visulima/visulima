import { readFileSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { dim, green, red, yellow } from "@visulima/colorize";
import { findPackageManagerSync } from "@visulima/package";
import { join, resolve } from "@visulima/path";
import { render, renderToString, Text } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

import type { CatalogCheckOptions, OutdatedEntry } from "../catalog";
import { checkOutdated, formatSummary, loadNpmrc, readCatalogs } from "../catalog";
import { error as errorOutput, info, note, success, warn } from "../output";
import type { OverrideEntry } from "../overrides";
import { applyOverrides, readLockfileText } from "../overrides";
import { detectPm, runInstall } from "../pm-runner";
import type { AcceptedRisk, PackageReportData } from "../socket-security";
import { buildSocketOptions, DEFAULT_LOW_SCORE_THRESHOLD, fetchSocketReports, findAcceptedRisk } from "../socket-security";
import type { VisConfig } from "../workspace";

import type { DuplicatePackage } from "./audit";
import { findDuplicateDependencies, scanInstalledPackages } from "./audit";
import { buildE18eEntries, buildSocketEntries, collectDepsFromPkgJson, discoverWorkspacePackages, markCodemodAvailability, runCodemod } from "./optimize";
import type { OptimizeEntry } from "../tui/components/optimize/OptimizeStore";

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
 */
const runAllScans = async (
    workspaceRoot: string,
    visConfig: VisConfig | undefined,
): Promise<DoctorResults> => {
    const pm = detectPm(workspaceRoot);
    const { packageManager } = findPackageManagerSync(workspaceRoot);

    // Collect deps across workspaces (shared by outdated + optimize scans)
    const rootDeps = collectDepsFromPkgJson(join(workspaceRoot, "package.json"), false);
    const workspaceDirs = discoverWorkspacePackages(workspaceRoot);
    const allDeps = new Set(rootDeps);

    for (const wsDir of workspaceDirs) {
        const wsDeps = collectDepsFromPkgJson(join(resolve(workspaceRoot, wsDir), "package.json"), false);

        for (const dep of wsDeps) {
            allDeps.add(dep);
        }
    }

    // Build scan config
    const npmrcConfig = loadNpmrc(workspaceRoot);
    const catalogs = readCatalogs(workspaceRoot, packageManager);
    const socketOpts = buildSocketOptions(visConfig?.security?.socket);
    const acceptedRisks = visConfig?.security?.socket?.acceptedRisks;
    const lockText = readLockfileText(workspaceRoot, pm.name);

    const checkOptions: CatalogCheckOptions = {
        exclude: [],
        ignore: [],
        include: [],
        includePrerelease: false,
        security: true,
        target: "latest",
    };

    // Run all scans in parallel
    const [outdatedResult, installed, duplicates, e18eEntries, socketEntries] = await Promise.all([
        catalogs.size > 0 ? checkOutdated(catalogs, checkOptions, npmrcConfig, undefined, workspaceRoot, socketOpts, acceptedRisks) : Promise.resolve({ failed: [], ignored: [], outdated: [] }),
        Promise.resolve(scanInstalledPackages(workspaceRoot)),
        findDuplicateDependencies(workspaceRoot, pm.name),
        Promise.resolve(buildE18eEntries(allDeps)),
        Promise.resolve(buildSocketEntries(allDeps, lockText, pm, false)),
    ]);

    // Deduplicate: e18e preferred over socket
    const e18eNames = new Set(e18eEntries.map((e) => e.packageName));
    const dedupedSocket = socketEntries.filter((e) => !e18eNames.has(e.packageName));
    const allOptimizations = [...e18eEntries, ...dedupedSocket];

    await markCodemodAvailability(allOptimizations);

    // Count Socket.dev issues from installed packages
    let socketAlerts = 0;
    let socketLowScore = 0;

    if (socketOpts && installed.length > 0) {
        const reports = await fetchSocketReports(
            installed.map((p) => ({ name: p.name, version: p.version })),
            socketOpts,
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

    // Count vulnerabilities
    let vulnCount = 0;

    for (const entry of outdatedResult.outdated) {
        if (entry.vulnerabilities && entry.vulnerabilities.length > 0) {
            vulnCount += entry.vulnerabilities.length;
        }
    }

    return {
        duplicates,
        installedCount: installed.length,
        optimizations: allOptimizations,
        outdated: outdatedResult.outdated,
        socketIssues: { alerts: socketAlerts, lowScore: socketLowScore },
        vulnCount,
        workspaceCount: workspaceDirs.length,
    };
};

// ── Display ─────────────────────────────────────────────────────────

const icon = (ok: boolean): string => (ok ? green("\u2713") : red("\u2717"));
const warnIcon = yellow("\u26A0");

const displayResults = (results: DoctorResults): void => {
    const {
        duplicates,
        installedCount,
        optimizations,
        outdated,
        socketIssues,
        vulnCount,
        workspaceCount,
    } = results;

    info("");

    // Dependencies section
    info(dim("\u2500\u2500 Dependencies \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
    info(`  ${icon(true)} ${String(installedCount)} packages installed`);

    if (outdated.length > 0) {
        const majors = outdated.filter((e) => e.updateType === "major").length;
        const minors = outdated.filter((e) => e.updateType === "minor").length;
        const patches = outdated.filter((e) => e.updateType === "patch").length;
        const parts: string[] = [];

        if (majors > 0) parts.push(`${String(majors)} major`);
        if (minors > 0) parts.push(`${String(minors)} minor`);
        if (patches > 0) parts.push(`${String(patches)} patch`);

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
    info(dim("\u2500\u2500 Security \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));

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
    info(dim("\u2500\u2500 Optimization \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));

    const natives = optimizations.filter((o) => o.category === "native").length;
    const preferred = optimizations.filter((o) => o.category === "preferred").length;
    const micros = optimizations.filter((o) => o.category === "micro-utility").length;
    const socketOverrides = optimizations.filter((o) => o.category === "socket").length;

    if (optimizations.length > 0) {
        if (natives > 0) info(`  ${warnIcon} ${String(natives)} replaceable with native APIs`);
        if (preferred > 0) info(`  ${warnIcon} ${String(preferred)} with lighter alternatives`);
        if (micros > 0) info(`  ${warnIcon} ${String(micros)} trivial micro-utilities`);
        if (socketOverrides > 0) info(`  ${warnIcon} ${String(socketOverrides)} @socketregistry overrides available`);
    } else {
        info(`  ${icon(true)} No optimizations available`);
    }

    // Summary
    info("");
    info(dim("\u2500\u2500 Summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));

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
 *
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
        ["vis doctor --json", "Machine-readable output for CI"],
        ["vis doctor --exit-code", "Exit with code 1 if issues found"],
    ],
    execute: async ({ logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root.");
        }

        const pm = detectPm(wsRoot);

        info(`\n  ${dim("VIS DOCTOR")} — project health check\n`);
        info(`  ${icon(true)} Detected ${pm.name} v${pm.version}`);

        const workspaceDirs = discoverWorkspacePackages(wsRoot);

        if (workspaceDirs.length > 0) {
            info(`  ${icon(true)} ${String(workspaceDirs.length)} workspace package${workspaceDirs.length === 1 ? "" : "s"}`);
        }

        info(`\n  Scanning...`);

        const results = await runAllScans(wsRoot, visConfig);

        // JSON output
        if (options.json) {
            process.stdout.write(
                JSON.stringify(
                    {
                        dependencies: {
                            duplicates: results.duplicates.length,
                            installed: results.installedCount,
                            outdated: results.outdated.length,
                        },
                        optimizations: {
                            microUtilities: results.optimizations.filter((o) => o.category === "micro-utility").length,
                            native: results.optimizations.filter((o) => o.category === "native").length,
                            preferred: results.optimizations.filter((o) => o.category === "preferred").length,
                            socket: results.optimizations.filter((o) => o.category === "socket").length,
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
                ) + "\n",
            );

            if (options["exit-code"] && (results.vulnCount > 0 || results.socketIssues.alerts > 0)) {
                process.exitCode = 1;
            }

            return;
        }

        displayResults(results);
        displayActions(results);

        if (options["exit-code"] && (results.vulnCount > 0 || results.socketIssues.alerts > 0)) {
            process.exitCode = 1;
        }
    },
    name: "doctor",
    options: [
        { defaultValue: false, description: "Output results as JSON", name: "json", type: Boolean },
        { defaultValue: false, description: "Exit with code 1 if security issues found", name: "exit-code", type: Boolean },
    ],
};

export default doctor;
