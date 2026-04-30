import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";
import { findPackageManagerSync } from "@visulima/package";
import { join, resolve } from "@visulima/path";
import { render } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

import { buildDoctorCacheKey, readDoctorCache, writeDoctorCache } from "../../cache/doctor-cache";
import { findVisConfigFile } from "../../config/config";
import type { VisConfig } from "../../config/workspace";
import { pail } from "../../io/logger";
import { SYMBOLS } from "../../io/symbols";
import { applyOverrides, readLockfileText } from "../../pm/overrides";
import { detectPm, runInstall } from "../../pm/pm-runner";
import type { RuntimeFinding } from "../../runtime/runtime-check";
import { checkRuntimeVersions } from "../../runtime/runtime-check";
import { killOrphanedRunners, ORPHANS_DIAGNOSTIC_ID, runRuntimeDiagnostics } from "../../runtime/runtime-diagnostics";
import type { ScanProgress, ScanTask } from "../../scan/scan-progress";
import { startScanProgress } from "../../scan/scan-progress";
import type { InstalledPackage } from "../../security/dependency-scan";
import { findDuplicateDependencies, lockedPackages } from "../../security/dependency-scan";
import type { PackageReportData } from "../../security/socket-security";
import { buildSocketOptions, DEFAULT_LOW_SCORE_THRESHOLD, fetchSocketReports } from "../../security/socket-security";
import { DoctorStore } from "../../tui/components/doctor/DoctorStore";
import type { DoctorFinding } from "../../tui/components/doctor/findings";
import { flattenFindings } from "../../tui/components/doctor/findings";
import type { DoctorBannerInput } from "../../tui/components/doctor/VisDoctorApp";
import VisDoctorApp from "../../tui/components/doctor/VisDoctorApp";
import type { CatalogCheckOptions } from "../../util/catalog";
import { checkOutdated, fetchVulnerabilities, loadNpmrc, readCatalogs } from "../../util/catalog";
import { buildE18eEntries, buildSocketEntries, collectDepsFromPkgJson, discoverWorkspacePackages, markCodemodAvailability, runCodemod } from "../optimize/handler";
import { applyFilter, filterFindingsByPattern, parseFilterPatterns } from "./filter";
import type { DoctorOptions } from "./index";
import type { DoctorResults, SectionId, SectionStatus } from "./sections";
import { buildJsonPayload, resolveSections, sectionStatus, shouldFail, summarizeOptimizations } from "./sections";
import { buildSupplyChainPosture } from "./supply-chain";

// ── Scan orchestration ──────────────────────────────────────────────

interface ScanContext {
    /** --filter regexes applied to per-section findings before they hit the store/results. */
    filterPatterns: ReadonlyArray<RegExp>;
    installed: InstalledPackage[];
    /** Inline scan-row reporter — only set in non-interactive mode. */
    progress?: ScanProgress;
    resolveCodemods: boolean;
    sections: Set<SectionId>;
    /** TUI store — only set in interactive mode. Receives per-section lifecycle events. */
    store?: DoctorStore;
    visConfig: VisConfig | undefined;
    workspaceRoot: string;
}

/**
 * Format a duration as a compact "1.2s" / "850ms" string for inline summaries.
 */
const fmtDuration = (ms: number): string => {
    if (ms >= 1000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }

    return `${String(Math.round(ms))}ms`;
};

/**
 * Run an async scan and route its lifecycle through the progress reporter
 * when one is supplied. In TUI mode `progress` is undefined and the wrapper
 * collapses to a plain await (the store handles per-section status).
 */
const tracked = async <T>(
    progress: ScanProgress | undefined,
    id: string,
    factory: () => Promise<T>,
    summarize: (value: T, durationMs: number) => { status: "error" | "ok" | "warn"; summary: string },
): Promise<T> => {
    if (!progress) {
        return factory();
    }

    progress.start(id);
    const startedAt = Date.now();

    try {
        const value = await factory();
        const elapsed = Date.now() - startedAt;
        const { status, summary } = summarize(value, elapsed);

        progress.finish(id, status, summary);

        return value;
    } catch (error) {
        const elapsed = Date.now() - startedAt;
        const message = error instanceof Error ? error.message : String(error);

        progress.finish(id, "error", `${message} (${fmtDuration(elapsed)})`);
        throw error;
    }
};

/**
 * Translate a partial DoctorResults snapshot into the findings that belong
 * to a single section. Lets the streaming path emit per-section finding
 * lists without re-implementing the flatten logic.
 */
const buildSectionFindings = (
    section: SectionId,
    payload: Pick<DoctorResults, "duplicates" | "optimizations" | "outdated" | "runtime">,
): DoctorFinding[] => {
    const partial: DoctorResults = {
        duplicates: payload.duplicates,
        elapsedMs: 0,
        installedCount: 0,
        optimizations: payload.optimizations,
        outdated: payload.outdated,
        runtime: payload.runtime,
        sections: new Set([section]),
        socketIssues: { alerts: 0, lowScore: 0 },
        supplyChain: { findings: [], status: "ok" },
        vulnCount: 0,
        workspaceCount: 0,
    };

    return flattenFindings(partial);
};

/**
 * Runs all diagnostic scans, optionally streaming per-section completion
 * into a {@link DoctorStore}. The same function powers both the inline
 * non-interactive run (with a {@link ScanProgress} reporter) and the live
 * TUI (with a store). Sync scans are essentially free and run inline.
 * Async scans gate on the active section set so `--only security` skips
 * the e18e/socket-override fan-out entirely.
 */
const streamScans = async (context: ScanContext): Promise<Omit<DoctorResults, "elapsedMs">> => {
    const { filterPatterns, installed, progress, resolveCodemods, sections, store, visConfig, workspaceRoot } = context;
    const wantsDeps = sections.has("dependencies");
    const wantsSec = sections.has("security");
    const wantsOpt = sections.has("optimization");
    const wantsRuntime = sections.has("runtime");
    const sectionFindings = (section: SectionId, payload: Pick<DoctorResults, "duplicates" | "optimizations" | "outdated" | "runtime">): DoctorFinding[] =>
        filterFindingsByPattern(buildSectionFindings(section, payload), filterPatterns);

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

    // Sync work first — essentially free. (`installed` was computed up
    // front by `execute()` so the banner can render before the recursive
    // node_modules walk.)
    const duplicates = wantsDeps ? findDuplicateDependencies(workspaceRoot, pm.name) : [];
    const e18eEntries = wantsOpt ? buildE18eEntries(allDeps) : [];
    const socketOverrideEntries = wantsOpt ? buildSocketEntries(allDeps, lockText, pm, false) : [];
    const e18eNames = new Set(e18eEntries.map((e) => e.packageName));
    const dedupedSocket = socketOverrideEntries.filter((e) => !e18eNames.has(e.packageName));
    const allOptimizations = [...e18eEntries, ...dedupedSocket];
    const runtime = wantsRuntime ? runRuntimeDiagnostics() : [];

    // Mark sections running so the TUI tabs show spinners straight away.
    // The messages are rendered as a single dim activity line beneath
    // the tab strip so the user can tell what is taking time on big
    // monorepos (registry round-trips dominate).
    if (store) {
        if (wantsDeps) {
            store.startSection("dependencies", catalogs.size > 0 ? "checking outdated catalog dependencies" : "scanning duplicates");
        }

        if (wantsSec) {
            store.startSection("security", installed.length > 0 ? `scanning ${String(installed.length)} packages for advisories` : "no installed packages to scan");
        }

        if (wantsOpt) {
            store.startSection("optimization", "matching e18e + socket overrides");
        }

        if (wantsRuntime) {
            store.startSection("runtime", "running runtime diagnostics");
        }
    }

    // Runtime is sync — flush immediately.
    if (store && wantsRuntime) {
        store.completeSection("runtime", sectionFindings("runtime", {
            duplicates: [],
            optimizations: [],
            outdated: [],
            runtime,
        }));
    }

    // Fan out async scans. Each runs only when its section is active.
    // `outdated` straddles dependencies (update counts) and security
    // (CVEs embedded on the entries), so it runs when either is selected.
    const needsOutdated = (wantsDeps || wantsSec) && catalogs.size > 0;

    const outdatedPromise = needsOutdated
        ? tracked(progress, "outdated", () => checkOutdated(catalogs, checkOptions, npmrcConfig, undefined, workspaceRoot, socketOptions, acceptedRisks), (result, ms) => {
            const count = result.outdated.length;

            return {
                status: count > 0 ? "warn" : "ok",
                summary: count > 0 ? `${String(count)} outdated · ${fmtDuration(ms)}` : `up to date · ${fmtDuration(ms)}`,
            };
        })
        : Promise.resolve({ failed: [], ignored: [], outdated: [] });

    const vulnPromise = wantsSec && installed.length > 0
        ? tracked(progress, "vulnerabilities", () => fetchVulnerabilities(installed.map((p) => { return { name: p.name, version: p.version }; })), (vulnMap, ms) => {
            let count = 0;

            for (const list of vulnMap.values()) {
                count += list.length;
            }

            return {
                status: count > 0 ? "error" : "ok",
                summary: count > 0 ? `${String(count)} found · ${fmtDuration(ms)}` : `none found · ${fmtDuration(ms)}`,
            };
        })
        : Promise.resolve(new Map<string, never[]>());

    const socketReportsPromise = wantsSec && socketOptions && installed.length > 0
        ? tracked(progress, "socket", () => fetchSocketReports(installed.map((p) => { return { name: p.name, version: p.version }; }), socketOptions), (reports, ms) => {
            let alerts = 0;
            let low = 0;

            for (const report of reports.values()) {
                alerts += report.alerts.length;

                if (report.score.overall < DEFAULT_LOW_SCORE_THRESHOLD) {
                    low += 1;
                }
            }

            const issues = alerts + low;

            return {
                status: issues > 0 ? "warn" : "ok",
                summary: issues > 0 ? `${String(alerts)} alert${alerts === 1 ? "" : "s"}, ${String(low)} low-score · ${fmtDuration(ms)}` : `clean · ${fmtDuration(ms)}`,
            };
        })
        : Promise.resolve(new Map<string, PackageReportData>());

    // Catch on each so a single registry timeout doesn't sink the
    // dashboard. The error string is captured separately so the streaming
    // path can fail the affected sections instead of silently completing
    // them with empty data.
    let outdatedError: string | undefined;
    let vulnError: string | undefined;
    let socketError: string | undefined;
    let optError: string | undefined;

    const outdatedSafe = outdatedPromise.catch((error: unknown) => {
        outdatedError = error instanceof Error ? error.message : String(error);

        if (!store) {
            pail.warn(`Outdated scan failed: ${outdatedError}`);
        }

        return { failed: [], ignored: [], outdated: [] };
    });

    const vulnSafe = vulnPromise.catch((error: unknown) => {
        vulnError = error instanceof Error ? error.message : String(error);

        if (!store) {
            pail.warn(`Vulnerability scan failed: ${vulnError}`);
        }

        return new Map<string, never[]>();
    });

    const socketSafe = socketReportsPromise.catch((error: unknown) => {
        socketError = error instanceof Error ? error.message : String(error);

        if (!store) {
            pail.warn(`Socket scan failed: ${socketError}`);
        }

        return new Map<string, PackageReportData>();
    });

    // Stream dependencies as soon as outdated lands — duplicates is sync
    // and already in hand.
    const depsStream = store && wantsDeps
        ? outdatedSafe.then((res) => {
            if (outdatedError) {
                store.failSection("dependencies", outdatedError);

                return;
            }

            store.completeSection("dependencies", sectionFindings("dependencies", {
                duplicates,
                optimizations: [],
                outdated: res.outdated,
                runtime: [],
            }));
        })
        : undefined;

    // Stream security only after every input scan settles — keeps the
    // tab spinner running until the section's count is final. Any of the
    // three failing flips the section to error so the user knows the
    // count is incomplete.
    const secStream = store && wantsSec
        ? Promise.all([outdatedSafe, vulnSafe, socketSafe]).then(([res]) => {
            const firstError = outdatedError ?? vulnError ?? socketError;

            if (firstError) {
                store.failSection("security", firstError);

                return;
            }

            store.completeSection("security", sectionFindings("security", {
                duplicates: [],
                optimizations: [],
                outdated: res.outdated,
                runtime: [],
            }));
        })
        : undefined;

    const optStream = (async () => {
        if (resolveCodemods && wantsOpt && allOptimizations.length > 0) {
            await tracked(progress, "codemods", async () => {
                await markCodemodAvailability(allOptimizations);

                return allOptimizations;
            }, (entries, ms) => {
                const fixable = entries.filter((entry) => entry.hasCodemod || entry.category === "socket").length;

                return {
                    status: "ok",
                    summary: `${String(fixable)} auto-fixable · ${fmtDuration(ms)}`,
                };
            }).catch((error: unknown) => {
                optError = error instanceof Error ? error.message : String(error);
            });
        }

        if (store && wantsOpt) {
            if (optError) {
                store.failSection("optimization", optError);

                return;
            }

            store.completeSection("optimization", sectionFindings("optimization", {
                duplicates: [],
                optimizations: allOptimizations,
                outdated: [],
                runtime: [],
            }));
        }
    })();

    const [outdatedResult, vulnMap, socketReports] = await Promise.all([outdatedSafe, vulnSafe, socketSafe]);

    await Promise.all([depsStream, secStream, optStream]);

    // Aggregate Socket findings
    let socketAlerts = 0;
    let socketLowScore = 0;

    if (wantsSec && socketOptions) {
        for (const report of socketReports.values()) {
            socketAlerts += report.alerts.length;

            if (report.score.overall < DEFAULT_LOW_SCORE_THRESHOLD) {
                socketLowScore += 1;
            }
        }
    }

    // Vulnerability count: from outdated entries + standalone fetch
    let vulnCount = 0;

    if (wantsSec) {
        for (const entry of outdatedResult.outdated) {
            if (entry.vulnerabilities && entry.vulnerabilities.length > 0) {
                vulnCount += entry.vulnerabilities.length;
            }
        }

        for (const list of vulnMap.values()) {
            vulnCount += (list as unknown[]).length;
        }
    }

    return {
        duplicates,
        installedCount: installed.length,
        optimizations: wantsOpt ? allOptimizations : [],
        outdated: wantsDeps ? outdatedResult.outdated : [],
        runtime,
        sections,
        socketIssues: { alerts: socketAlerts, lowScore: socketLowScore },
        // Supply-chain posture is config-derived and cheap; always
        // compute so the doctor section can render even when --only is
        // limited to other sections (the section filters its own
        // visibility in displayResults).
        supplyChain: buildSupplyChainPosture(visConfig),
        vulnCount,
        workspaceCount: workspaceDirectories.length,
    };
};

// ── Display ─────────────────────────────────────────────────────────

const sectionIcon = (status: SectionStatus): string => {
    switch (status) {
        case "error": {
            return red(SYMBOLS.failure);
        }
        case "skip": {
            return dim(SYMBOLS.dash);
        }
        case "warn": {
            return yellow(SYMBOLS.warning);
        }
        default: {
            return green(SYMBOLS.success);
        }
    }
};

/**
 * Width-adaptive heading. Falls back to a plain title in narrow shells.
 */
const heading = (title: string, status: SectionStatus): string => {
    const cols = process.stderr.columns ?? 80;
    const cap = Math.max(20, Math.min(cols - 2, 60));
    const decoration = SYMBOLS.dash.repeat(2);
    const label = `${sectionIcon(status)} ${bold(title)}`;
    // strip-ansi-light: count width by stripping known ANSI escapes.
    // eslint-disable-next-line no-control-regex
    const labelWidth = label.replaceAll(/\[[0-9;]*m/g, "").length;
    const remaining = Math.max(0, cap - labelWidth - decoration.length - 2);

    return `${decoration} ${label} ${dim(SYMBOLS.dash.repeat(remaining))}`;
};

const itemOk = (text: string): string => `  ${green(SYMBOLS.success)} ${text}`;
const itemWarn = (text: string): string => `  ${yellow(SYMBOLS.warning)} ${text}`;
const itemError = (text: string): string => `  ${red(SYMBOLS.failure)} ${text}`;
const itemSkip = (text: string): string => `  ${dim(SYMBOLS.dash)} ${dim(text)}`;

/**
 * Format `&lt;count> &lt;label>` with the count emphasised and the prose
 * dimmed, optionally with a dim parenthetical breakdown. Lets the eye
 * skim numbers down a column without losing the descriptive context.
 */
const countLine = (count: number, label: string, parenthetical?: string): string => {
    const head = `${bold(String(count))} ${dim(label)}`;

    return parenthetical ? `${head} ${dim(`(${parenthetical})`)}` : head;
};

const displayDependencies = (results: DoctorResults): void => {
    if (!results.sections.has("dependencies")) {
        return;
    }

    pail.log("");
    pail.log(heading("Dependencies", sectionStatus(results, "dependencies")));
    pail.log(itemOk(countLine(results.installedCount, "packages installed")));

    if (results.outdated.length > 0) {
        const majors = results.outdated.filter((e) => e.updateType === "major").length;
        const minors = results.outdated.filter((e) => e.updateType === "minor").length;
        const patches = results.outdated.filter((e) => e.updateType === "patch").length;
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

        pail.log(itemWarn(countLine(results.outdated.length, "outdated", parts.join(", "))));
    } else {
        pail.log(itemOk("All dependencies up to date"));
    }

    if (results.duplicates.length > 0) {
        pail.log(itemWarn(countLine(results.duplicates.length, "packages with duplicate versions")));
    } else {
        pail.log(itemOk("No duplicate dependencies"));
    }
};

const displaySecurity = (results: DoctorResults): void => {
    if (!results.sections.has("security")) {
        return;
    }

    pail.log("");
    pail.log(heading("Security", sectionStatus(results, "security")));

    if (results.vulnCount > 0) {
        pail.log(itemError(countLine(results.vulnCount, `vulnerabilit${results.vulnCount === 1 ? "y" : "ies"} found`)));
    } else {
        pail.log(itemOk("No known vulnerabilities"));
    }

    if (results.socketIssues.alerts > 0) {
        pail.log(itemWarn(countLine(results.socketIssues.alerts, `Socket.dev security alert${results.socketIssues.alerts === 1 ? "" : "s"}`)));
    }

    if (results.socketIssues.lowScore > 0) {
        pail.log(itemWarn(countLine(results.socketIssues.lowScore, `package${results.socketIssues.lowScore === 1 ? "" : "s"} with low security score`)));
    }

    if (results.socketIssues.alerts === 0 && results.socketIssues.lowScore === 0 && results.vulnCount === 0) {
        pail.log(itemOk("No security issues detected"));
    }
};

const displayOptimization = (results: DoctorResults): void => {
    if (!results.sections.has("optimization")) {
        return;
    }

    pail.log("");
    pail.log(heading("Optimization", sectionStatus(results, "optimization")));

    const counts = summarizeOptimizations(results.optimizations);

    if (counts.total === 0) {
        pail.log(itemOk("No optimizations available"));

        return;
    }

    if (counts.native > 0) {
        pail.log(itemWarn(countLine(counts.native, "replaceable with native APIs")));
    }

    if (counts.preferred > 0) {
        pail.log(itemWarn(countLine(counts.preferred, "with lighter alternatives")));
    }

    if (counts.micro > 0) {
        pail.log(itemWarn(countLine(counts.micro, "trivial micro-utilities")));
    }

    if (counts.socket > 0) {
        pail.log(itemWarn(countLine(counts.socket, "@socketregistry overrides available")));
    }
};

/**
 * Render the static supply-chain hardening posture as its own section.
 * Always emits when `displayResults` runs, regardless of `--only` /
 * `--skip` filters — the section is config-derived (no scan cost), so
 * gating it would just hide the hardening knobs from the user. Live
 * security findings (vulns, alerts) remain in the Security section.
 */
const displaySupplyChain = (results: DoctorResults): void => {
    pail.log("");
    pail.log(heading("Supply Chain", results.supplyChain.status));

    for (const finding of results.supplyChain.findings) {
        const line = finding.severity === "ok"
            ? itemOk(finding.label)
            : finding.severity === "error"
                ? itemError(finding.label)
                : itemWarn(finding.label);

        pail.log(line);

        if (finding.detail) {
            pail.log(`  ${dim(SYMBOLS.arrow)} ${dim(finding.detail)}`);
        }
    }

    if (results.supplyChain.status !== "ok") {
        pail.log(`  ${dim(SYMBOLS.arrow)} ${dim("Configure with security.* in vis.config.ts. See `vis check --security-config` for details.")}`);
    }
};

const displayRuntime = (results: DoctorResults): void => {
    if (!results.sections.has("runtime")) {
        return;
    }

    pail.log("");
    pail.log(heading("Runtime", sectionStatus(results, "runtime")));

    for (const diagnostic of results.runtime) {
        if (diagnostic.status === "ok") {
            pail.log(itemOk(diagnostic.message));
        } else if (diagnostic.status === "skip") {
            pail.log(itemSkip(diagnostic.message));
        } else {
            pail.log(itemWarn(diagnostic.message));
        }
    }
};

const displaySummary = (results: DoctorResults, quiet: boolean): void => {
    const criticalCount = results.vulnCount;
    const runtimeWarnings = results.runtime.filter((d) => d.status === "warn").length;
    const improvementCount = results.outdated.length + results.duplicates.length + results.optimizations.length + runtimeWarnings;

    if (quiet) {
        // One-line summary — no banner, no info: prefix.
        if (criticalCount === 0 && improvementCount === 0) {
            pail.success(`Everything looks good! ${dim(`(${fmtDuration(results.elapsedMs)})`)}`);
        } else {
            const parts: string[] = [];

            if (criticalCount > 0) {
                parts.push(red(`${String(criticalCount)} security`));
            }

            if (improvementCount > 0) {
                parts.push(yellow(`${String(improvementCount)} improvement${improvementCount === 1 ? "" : "s"}`));
            }

            pail.log(`${red(SYMBOLS.failure)} ${parts.join(", ")} ${dim(`(${fmtDuration(results.elapsedMs)})`)}`);
        }

        return;
    }

    pail.log("");
    pail.log(heading("Summary", "ok"));

    if (criticalCount === 0 && improvementCount === 0) {
        pail.success(`Everything looks good! ${dim(`(${fmtDuration(results.elapsedMs)})`)}`);
    } else {
        if (criticalCount > 0) {
            pail.error(`${String(criticalCount)} security issue${criticalCount === 1 ? "" : "s"}`);
        }

        if (improvementCount > 0) {
            pail.log(`  ${cyan(SYMBOLS.arrow)} ${bold(String(improvementCount))} ${dim(`improvement${improvementCount === 1 ? "" : "s"} available`)} ${dim(`(${fmtDuration(results.elapsedMs)})`)}`);
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
        pail.log("");
        pail.log(bold("Next steps:"));

        for (const action of actions) {
            pail.log(`  ${dim(SYMBOLS.arrow)} ${action}`);
        }
    }

    pail.log("");
};

const displayResults = (results: DoctorResults, quiet: boolean): void => {
    if (!quiet) {
        displayDependencies(results);
        displaySecurity(results);
        displayOptimization(results);
        displayRuntime(results);
        displaySupplyChain(results);
    }

    displaySummary(results, quiet);
};

// ── Scan task list ──────────────────────────────────────────────────

interface BannerInputs {
    nodeVersion: string;
    packageManagerName: string;
    packageManagerVersion: string;
    runtimeFindings: RuntimeFinding[];
    /** Workspace package count, or `undefined` when not surveyed yet. */
    workspaceCount: number | undefined;
}

const planScanTasks = (
    sections: Set<SectionId>,
    catalogsCount: number,
    socketEnabled: boolean,
    installedCount: number,
    fix: boolean,
): ScanTask[] => {
    const tasks: ScanTask[] = [];
    const wantsDeps = sections.has("dependencies");
    const wantsSec = sections.has("security");
    const wantsOpt = sections.has("optimization");

    if ((wantsDeps || wantsSec) && catalogsCount > 0) {
        tasks.push({ id: "outdated", label: "Outdated catalog dependencies" });
    }

    if (wantsSec && installedCount > 0) {
        tasks.push({ id: "vulnerabilities", label: "Known vulnerabilities (OSV)" });
    }

    if (wantsSec && socketEnabled && installedCount > 0) {
        tasks.push({ id: "socket", label: "Socket.dev supply-chain reports" });
    }

    if (wantsOpt && fix) {
        tasks.push({ id: "codemods", label: "Codemod availability" });
    }

    return tasks;
};

const printBanner = (input: BannerInputs): void => {
    pail.log("");
    pail.log(`${bold(cyan("vis doctor"))} ${dim("— project health check")}`);
    pail.log(itemOk(`Detected ${input.packageManagerName} v${input.packageManagerVersion}`));

    if (input.workspaceCount !== undefined && input.workspaceCount > 0) {
        pail.log(itemOk(countLine(input.workspaceCount, `workspace package${input.workspaceCount === 1 ? "" : "s"}`)));
    }

    if (input.runtimeFindings.length === 0) {
        pail.log(itemOk(`Node.js ${input.nodeVersion}`));
    } else {
        for (const finding of input.runtimeFindings) {
            const colour = finding.severity === "error" ? red : yellow;

            pail.log(itemError(`Runtime: ${colour(finding.message)}`));
        }

        pail.log(`  ${dim(SYMBOLS.arrow)} Run ${green("vis toolchain install")} to install pinned versions, or ${green("vis toolchain status")} for the per-tool breakdown.`);
    }

    pail.log("");
};

// ── Main execute ────────────────────────────────────────────────────

const execute = async ({ logger, options, visConfig, visConfigError, workspaceRoot: wsRoot }: Toolbox<Console, DoctorOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root.");
    }

    const isJson = options.format === "json" || options.json === true;
    const sections = resolveSections(options.only, options.skip);
    const quiet = Boolean(options.quiet);
    const noProgress = Boolean(options.noProgress);
    const filterPatterns = parseFilterPatterns(options.filter);

    if (sections.size === 0) {
        pail.error("No sections selected. Check your --only / --skip values.");
        process.exitCode = 2;

        return;
    }

    const startedAt = Date.now();
    const pm = detectPm(wsRoot);
    const runtimeFindings = checkRuntimeVersions(wsRoot);

    // Decide TUI vs inline progress up front so the banner / pre-scan
    // chatter doesn't double-render with the TUI.
    const stdoutTty = Boolean(process.stdout.isTTY);
    const wantsInteractive = !isJson && stdoutTty && !isInCi && !quiet && !noProgress;

    // Print the banner up front so the user gets immediate feedback that
    // the command is alive — the surveys below can take a few seconds on
    // large monorepos (recursive node_modules walk + lockfile parse).
    // In TUI mode we skip the inline banner; the TUI takes over the screen.
    if (!isJson && !wantsInteractive) {
        printBanner({
            nodeVersion: process.versions.node,
            packageManagerName: pm.name,
            packageManagerVersion: pm.version,
            runtimeFindings,
            workspaceCount: undefined,
        });
    }

    // Pre-scan: cheap surveys we need before deciding which scan rows
    // to draw. Lockfile parse is ~80ms even on large monorepos.

    const catalogs = readCatalogs(wsRoot, findPackageManagerSync(wsRoot).packageManager);
    const installed = lockedPackages(wsRoot, pm.name);
    const installedCount = installed.length;
    const socketEnabled = Boolean(buildSocketOptions(visConfig?.security?.socket));
    const workspaceDirectories = discoverWorkspacePackages(wsRoot);

    if (!isJson && !quiet && !wantsInteractive) {
        const wsLine = workspaceDirectories.length > 0
            ? dim(` · ${String(workspaceDirectories.length)} workspace package${workspaceDirectories.length === 1 ? "" : "s"}`)
            : "";

        pail.log(`${dim("·")} ${dim("Found")} ${bold(String(installedCount))} ${dim(`installed package${installedCount === 1 ? "" : "s"}`)}${wsLine}`);
    }

    const banner: DoctorBannerInput | undefined = visConfigError
        ? {
            hint: visConfigError.file
                ? `Continuing with default settings — fix or regenerate ${visConfigError.file} (vis init --force).`
                : "Continuing with default settings.",
            message: visConfigError.message,
            severity: "error",
            title: visConfigError.file ? `Failed to load ${visConfigError.file}` : "Failed to load vis.config",
        }
        : undefined;

    // Cache: skip when --fix (mutates workspace) or --no-cache. The
    // lockfile mtime is the primary invalidation signal — if deps
    // didn't change, the catalog/duplicate/security scans return the
    // same answers.
    const lockfileNameByPm: Record<string, string> = {
        bun: "bun.lock",
        npm: "package-lock.json",
        pnpm: "pnpm-lock.yaml",
        yarn: "yarn.lock",
    };
    const lockfileFile = lockfileNameByPm[pm.name];
    const lockfilePath = lockfileFile ? join(wsRoot, lockfileFile) : undefined;
    const configFilePath = findVisConfigFile(wsRoot);
    const cacheEnabled = !options.noCache && !options.fix;
    const cacheKey = cacheEnabled
        ? buildDoctorCacheKey({
            configPath: configFilePath,
            lockfilePath,
            sections,
            socketEnabled,
            workspaceRoot: wsRoot,
        })
        : undefined;

    const cachedResults = cacheKey ? readDoctorCache(cacheKey) : undefined;
    const cacheHit = cachedResults !== undefined;

    let scanResults: Omit<DoctorResults, "elapsedMs">;
    let pendingAction: ReturnType<DoctorStore["getSnapshot"]>["pendingAction"];

    if (wantsInteractive) {
        // TUI is the primary surface for interactive runs — mount it
        // whether scans need to run or we can seed from cache. Cache
        // hits skip the streaming work but still let the user explore
        // findings instead of dumping a static summary to the terminal.
        const store = cachedResults
            ? new DoctorStore({ activeSections: sections, findings: filterFindingsByPattern(flattenFindings(cachedResults), filterPatterns) })
            : new DoctorStore({ activeSections: sections });

        const instance = render(
            React.createElement(VisDoctorApp, { banner, fromCache: cacheHit, startedAt, store }),
            {
                alternateScreen: true,
                exitOnCtrlC: false,
                interactive: true,
                patchConsole: true,
            },
        );

        try {
            scanResults = cachedResults ?? await streamScans({
                filterPatterns,
                installed,
                resolveCodemods: Boolean(options.fix),
                sections,
                store,
                visConfig,
                workspaceRoot: wsRoot,
            });
        } catch (error) {
            // Make sure the TUI can be dismissed even if a scan throws.
            instance.unmount();
            throw error;
        }

        await instance.waitUntilExit();
        pendingAction = store.getSnapshot().pendingAction;
    } else if (cachedResults) {
        // Non-interactive cache hit — skip scans, print the summary inline.
        scanResults = cachedResults;
    } else {
        const tasks = planScanTasks(sections, catalogs.size, socketEnabled, installedCount, Boolean(options.fix));
        const live = !isJson && !quiet && !noProgress;
        const progress = startScanProgress(tasks, { live });

        try {
            scanResults = await streamScans({
                filterPatterns,
                installed,
                progress,
                resolveCodemods: Boolean(options.fix),
                sections,
                visConfig,
                workspaceRoot: wsRoot,
            });
        } finally {
            progress.stop();
        }
    }

    const fullResults: DoctorResults = { ...scanResults, elapsedMs: Date.now() - startedAt };

    // Cache the full unfiltered results so a later run with a different
    // --filter still hits cache. Filtering happens post-cache.
    if (cacheKey && !cacheHit) {
        try {
            writeDoctorCache(cacheKey, fullResults);
        } catch {
            // Cache writes are best-effort; a failed write shouldn't
            // break the user's doctor run.
        }
    }

    const results = applyFilter(fullResults, filterPatterns);

    // JSON output
    if (isJson) {
        process.stdout.write(`${JSON.stringify(buildJsonPayload(results, pm.name), undefined, 2)}\n`);

        if (options.exitCode && shouldFail(results, Boolean(options.strict))) {
            process.exitCode = 1;
        }

        return;
    }

    if (cacheHit && !quiet) {
        pail.log(`${dim("·")} Cached results (use --no-cache to refresh)`);
    }

    if (filterPatterns.length > 0 && !quiet) {
        pail.log(`${dim("·")} Filter active: ${cyan(options.filter ?? "")}`);
    }

    displayResults(results, quiet);

    // --fix: auto-remediate by running optimize (codemods + overrides + install)
    // and clean up orphaned vis/task-runner processes the runtime check found.
    const hasOrphanWarning = results.runtime.some((d) => d.id === ORPHANS_DIAGNOSTIC_ID && d.status === "warn");
    const hasOptimizationFixes = results.sections.has("optimization") && results.optimizations.length > 0;

    if (options.fix && (hasOptimizationFixes || hasOrphanWarning)) {
        await runFixes({
            force: Boolean(options.fixForce),
            logger,
            pm,
            recoverOrphans: hasOrphanWarning,
            results,
            workspaceRoot: wsRoot,
        });
    } else if (!quiet) {
        displayActions(results);
    }

    if (pendingAction) {
        process.stdout.write("\n");
        process.stdout.write(`${bold("→ ")}${pendingAction.description}\n`);

        if (pendingAction.configSnippet) {
            process.stdout.write("\n");
            process.stdout.write(`${dim(pendingAction.configSnippet)}\n`);
        } else {
            process.stdout.write(`  ${cyan(pendingAction.command)}\n`);
        }

        process.stdout.write("\n");
    }

    if (options.exitCode && shouldFail(results, Boolean(options.strict))) {
        process.exitCode = 1;
    }
};

// ── --fix flow ──────────────────────────────────────────────────────

interface PmLike {
    name: string;
}

interface RunFixesOptions {
    /** Pass `true` for `--fix-force`: orphan cleanup escalates straight to SIGKILL. */
    force: boolean;
    logger: Console;
    pm: PmLike;
    /** When true, run {@link killOrphanedRunners} after the optimization fixes. */
    recoverOrphans: boolean;
    results: DoctorResults;
    workspaceRoot: string;
}

const runFixes = async (opts: RunFixesOptions): Promise<void> => {
    const { force, logger, pm, recoverOrphans, results, workspaceRoot } = opts;

    pail.log("");
    pail.log(heading("Applying fixes", "ok"));

    const socketEntries = results.optimizations
        .filter((o) => o.category === "socket" && o.overrideSpec)
        .map((o) => { return { original: o.packageName, spec: o.overrideSpec! }; });
    const codemodEntries = results.optimizations.filter((o) => o.category !== "socket" && o.hasCodemod);
    const manualEntries = results.optimizations.filter((o) => o.category !== "socket" && !o.hasCodemod);

    let didSomething = false;
    let codemodsApplied = 0;
    const codemodFailures: { error: string; package: string }[] = [];

    if (recoverOrphans) {
        // SIGTERM by default — give the orphans a chance to flush buffered
        // output and tear down child trees gracefully. `--fix-force`
        // escalates to SIGKILL for SIGTERM-resistant processes (Windows
        // child trees, blocked event loops).
        //
        // We deliberately re-enumerate via killOrphanedRunners() rather than
        // pass through the cached pids from `results.runtime`. Between the
        // diagnostic running and `--fix` running, the orphan set can change
        // (a `vis run` in another terminal could exit, or a new crash could
        // leave a fresh orphan); re-enumerating keeps us aligned with the
        // current process table.
        const recovery = killOrphanedRunners({ force });

        if (recovery.killed.length > 0) {
            pail.success(`Cleaned up ${String(recovery.killed.length)} orphaned process${recovery.killed.length === 1 ? "" : "es"} (PIDs: ${recovery.killed.join(", ")}).`);
            didSomething = true;
        }

        if (recovery.failed.length > 0) {
            const escalation = force ? "" : " Re-run with `--fix --fix-force` to escalate to SIGKILL.";

            pail.warn(`Could not signal ${String(recovery.failed.length)} orphan${recovery.failed.length === 1 ? "" : "s"}: ${recovery.failed.map((f) => `${String(f.pid)} (${f.reason})`).join(", ")}.${escalation}`);
        }
    }

    if (socketEntries.length > 0) {
        const overrideResult = applyOverrides(workspaceRoot, join(workspaceRoot, "package.json"), socketEntries, pm as Parameters<typeof applyOverrides>[3]);

        if (overrideResult.added.length > 0) {
            pail.success(`Added ${String(overrideResult.added.length)} security override${overrideResult.added.length === 1 ? "" : "s"}.`);
            didSomething = true;
        }

        if (overrideResult.updated.length > 0) {
            pail.success(`Updated ${String(overrideResult.updated.length)} override${overrideResult.updated.length === 1 ? "" : "s"}.`);
            didSomething = true;
        }
    }

    for (const entry of codemodEntries) {
        try {
            const codemodResult = await runCodemod(workspaceRoot, entry.packageName);

            if (codemodResult.filesChanged > 0) {
                pail.success(`${entry.packageName}: ${String(codemodResult.filesChanged)} file${codemodResult.filesChanged === 1 ? "" : "s"} updated`);
                codemodsApplied += 1;
                didSomething = true;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            codemodFailures.push({ error: message, package: entry.packageName });
            pail.warn(`${entry.packageName}: codemod failed — ${message}`);
        }
    }

    if (socketEntries.length > 0) {
        pail.log(`${cyan(SYMBOLS.arrow)} Running ${pm.name} install to update lockfile…`);

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

        runInstall(pm as Parameters<typeof runInstall>[0], installOptions, workspaceRoot, logger);
        didSomething = true;
    }

    pail.log("");

    if (didSomething) {
        pail.success(`Fixes applied. ${codemodsApplied > 0 ? `${String(codemodsApplied)} codemod${codemodsApplied === 1 ? "" : "s"} applied.` : ""}`.trim());
    } else {
        pail.log(itemSkip("No auto-fixable items in the current run."));
    }

    if (codemodFailures.length > 0) {
        pail.warn(`${String(codemodFailures.length)} codemod${codemodFailures.length === 1 ? "" : "s"} failed (run ${green("vis optimize")} for the interactive picker).`);
    }

    if (manualEntries.length > 0) {
        pail.notice(`${String(manualEntries.length)} optimization${manualEntries.length === 1 ? "" : "s"} need manual review (no codemod). Run ${green("vis optimize")} to inspect them.`);
    }
};

export default execute as CommandExecute<Toolbox>;
