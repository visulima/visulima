import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { cyan, dim, magenta, red, yellow } from "@visulima/colorize";

import { isAdvisoryExcluded, isPackageExcluded, readNativeAuditExclusions, syncAcceptedRisksToNativeConfig } from "../../audit-config";
import type { SecurityVulnerability } from "../../catalog";
import { fetchVulnerabilities } from "../../catalog";
import { findDuplicateDependencies, lockedPackages } from "../../dependency-scan";
import { error as errorOutput, info, note, success, warn } from "../../output";
import { detectPm } from "../../pm-runner";
import { startScanProgress } from "../../scan-progress";
import type { AcceptedRisk, PackageReportData } from "../../socket-security";
import { buildSocketOptions, DEFAULT_LOW_SCORE_THRESHOLD, fetchSocketReports, findAcceptedRisk, getFullPackageName, scoreLabel } from "../../socket-security";
import type { VisConfig } from "../../workspace";
import type { AuditOptions } from "./index";

// ── Types ───────────────────────────────────────────────────────────

interface AuditEntry {
    acceptedRisk?: AcceptedRisk;
    name: string;
    socketReport?: PackageReportData;
    version: string;
    vulnerabilities: SecurityVulnerability[];
}

type SeverityFilter = "critical" | "high" | "low" | "medium";

// ── Severity helpers ────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    LOW: 3,
    MODERATE: 2,
    UNKNOWN: 4,
};

const SOCKET_ALERT_COLORS: Record<string, (s: string) => string> = {
    critical: red,
    high: magenta,
    low: cyan,
    medium: yellow,
};

const severityPassesFilter = (severity: string, filter: SeverityFilter): boolean => {
    const filterLevel = SEVERITY_ORDER[filter.toUpperCase()] ?? SEVERITY_ORDER.MODERATE ?? 2;
    const vulnLevel = SEVERITY_ORDER[severity.toUpperCase()] ?? 4;

    return vulnLevel <= filterLevel;
};

// ── Display helpers ─────────────────────────────────────────────────

const SEVERITY_COLOR_FN: Record<string, (s: string) => string> = {
    CRITICAL: red,
    HIGH: magenta,
    LOW: cyan,
    MODERATE: yellow,
    UNKNOWN: dim,
};

const formatVulnLine = (name: string, version: string, vuln: SecurityVulnerability, isAccepted: boolean): string => {
    const colorFunction = SEVERITY_COLOR_FN[vuln.severity] ?? dim;
    const badge = isAccepted ? ` ${dim("[acknowledged]")}` : "";
    const fixedVersions = vuln.fixedVersions ?? [];
    const fixed = fixedVersions.length > 0 ? ` (fix: ${fixedVersions.join(", ")})` : "";

    return `  ${colorFunction(vuln.severity)} ${vuln.id} — ${name}@${version}${badge}\n    ${vuln.summary}${fixed}`;
};

const formatSocketLine = (report: PackageReportData, isAccepted: boolean): string => {
    const name = getFullPackageName(report);
    const pct = `${String(Math.round(report.score.overall * 100))}%`;
    const badge = isAccepted ? ` ${dim("[acknowledged]")}` : "";
    const alerts = report.alerts.length > 0 ? `, ${String(report.alerts.length)} alert${report.alerts.length === 1 ? "" : "s"}` : "";

    return `  ${pct} ${name}@${report.version} (${scoreLabel(report.score.overall)}${alerts})${badge}`;
};

// ── Main audit logic ────────────────────────────────────────────────

const executeAudit = async (workspaceRoot: string, options: Record<string, unknown>, visConfig: VisConfig | undefined, _logger: Console): Promise<void> => {
    const severityFilter = (options.severity as SeverityFilter | undefined) ?? "low";
    const isJson = (options.format as string) === "json" || Boolean(options.json);
    const showFixes = Boolean(options.fix);
    const showAccepted = Boolean(options.showAccepted);
    const socketConfig = visConfig?.security?.socket;
    const acceptedRisks = socketConfig?.acceptedRisks;

    // Read native PM audit exclusions
    const pm = detectPm(workspaceRoot);
    const nativeExclusions = readNativeAuditExclusions(workspaceRoot, pm.name);

    if (nativeExclusions.ignoredAdvisories.length > 0 || nativeExclusions.excludedPackages.length > 0) {
        info(
            `Loaded ${String(nativeExclusions.ignoredAdvisories.length)} ignored advisor${nativeExclusions.ignoredAdvisories.length === 1 ? "y" : "ies"} and ${String(nativeExclusions.excludedPackages.length)} excluded package${nativeExclusions.excludedPackages.length === 1 ? "" : "s"} from ${pm.name} config.`,
        );
    }

    // 1. Discover installed packages from the lockfile (single parse,
    // no recursive node_modules walk).
    const installed = lockedPackages(workspaceRoot, pm.name);

    if (installed.length === 0) {
        info(`No ${pm.name} lockfile entries found. Run ${pm.name} install first.`);

        return;
    }

    if (!isJson) {
        info(`Scanning ${String(installed.length)} installed packages…`);
    }

    // 2. Fetch vulnerability and security data in parallel
    const packagesToScan = installed.map((p) => {
        return { name: p.name, version: p.version };
    });

    const socketOptions = buildSocketOptions(socketConfig);

    // findDuplicateDependencies is synchronous — hoist it outside Promise.all
    // so the async fan-out only contains genuine async work.
    const duplicates = findDuplicateDependencies(workspaceRoot, pm.name);

    // Live progress: one row per network-bound scan. JSON consumers get
    // no progress UI (it would corrupt the output stream).
    const progressTasks = [
        { id: "vulnerabilities", label: "Known vulnerabilities (OSV)" },
        ...(socketOptions ? [{ id: "socket", label: "Socket.dev supply-chain reports" }] : []),
    ];
    const progress = startScanProgress(progressTasks, { live: !isJson });
    const startedAt = Date.now();
    const fmtElapsed = (start: number): string => {
        const ms = Date.now() - start;

        return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${String(Math.round(ms))}ms`;
    };

    let vulnMap: Awaited<ReturnType<typeof fetchVulnerabilities>>;
    let socketReports: Map<string, PackageReportData>;

    try {
        const vulnStart = Date.now();
        const socketStart = Date.now();

        progress.start("vulnerabilities");

        if (socketOptions) {
            progress.start("socket");
        }

        [vulnMap, socketReports] = await Promise.all([
            fetchVulnerabilities(packagesToScan).then((map) => {
                let count = 0;

                for (const list of map.values()) {
                    count += list.length;
                }

                progress.finish("vulnerabilities", count > 0 ? "warn" : "ok", count > 0 ? `${String(count)} found · ${fmtElapsed(vulnStart)}` : `none found · ${fmtElapsed(vulnStart)}`);

                return map;
            }).catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);

                progress.finish("vulnerabilities", "error", message);

                return new Map();
            }),
            socketOptions
                ? fetchSocketReports(packagesToScan, socketOptions).then((reports) => {
                    let alerts = 0;
                    let low = 0;

                    for (const report of reports.values()) {
                        alerts += report.alerts.length;

                        if (report.score.overall < DEFAULT_LOW_SCORE_THRESHOLD) {
                            low += 1;
                        }
                    }

                    const total = alerts + low;

                    progress.finish("socket", total > 0 ? "warn" : "ok", total > 0 ? `${String(alerts)} alert${alerts === 1 ? "" : "s"}, ${String(low)} low-score · ${fmtElapsed(socketStart)}` : `clean · ${fmtElapsed(socketStart)}`);

                    return reports;
                }).catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : String(error);

                    progress.finish("socket", "error", message);

                    return new Map<string, PackageReportData>();
                })
                : Promise.resolve(new Map<string, PackageReportData>()),
        ]);
    } finally {
        progress.stop();
    }

    if (!isJson) {
        info(dim(`Scan completed in ${fmtElapsed(startedAt)}`));
    }

    // 3. Build audit entries
    const entries: AuditEntry[] = [];

    for (const pkg of installed) {
        // Skip packages excluded by native PM config (yarn npmAuditExcludePackages)
        if (isPackageExcluded(pkg.name, nativeExclusions)) {
            continue;
        }

        const vulns = vulnMap.get(pkg.name) ?? [];
        const report = socketReports.get(`${pkg.name}@${pkg.version}`);
        const accepted = findAcceptedRisk(pkg.name, pkg.version, acceptedRisks);

        const hasVulns = vulns.length > 0;
        const hasLowScore = report ? report.score.overall < DEFAULT_LOW_SCORE_THRESHOLD : false;
        const hasAlerts = report ? report.alerts.length > 0 : false;

        if (hasVulns || hasLowScore || hasAlerts) {
            entries.push({
                acceptedRisk: accepted,
                name: pkg.name,
                socketReport: report,
                version: pkg.version,
                vulnerabilities: vulns,
            });
        }
    }

    // 4. Filter by severity
    const filtered = entries.filter((entry) => {
        const vulnPasses = entry.vulnerabilities.some((v) => severityPassesFilter(v.severity, severityFilter));
        const socketPasses = entry.socketReport?.alerts.some((a) =>
            severityPassesFilter(a.severity === "medium" ? "MODERATE" : a.severity.toUpperCase(), severityFilter),
        );
        const lowScorePasses = entry.socketReport && entry.socketReport.score.overall < DEFAULT_LOW_SCORE_THRESHOLD;

        return vulnPasses || socketPasses || lowScorePasses;
    });

    // 5. JSON output
    if (isJson) {
        const jsonResult = {
            duplicates: duplicates.map((d) => {
                return {
                    name: d.name,
                    versionCount: d.versions.length,
                    versions: d.versions,
                };
            }),
            packages: installed.length,
            results: filtered.map((e) => {
                return {
                    acceptedRisk: e.acceptedRisk ?? null,
                    name: e.name,
                    socketAlerts: e.socketReport?.alerts ?? [],
                    socketScore: e.socketReport?.score.overall ?? null,
                    version: e.version,
                    vulnerabilities: e.vulnerabilities,
                };
            }),
            summary: {
                accepted: filtered.filter((e) => e.acceptedRisk).length,
                duplicatePackages: duplicates.length,
                issues: filtered.filter((e) => !e.acceptedRisk).length,
                total: filtered.length,
            },
        };

        process.stdout.write(`${JSON.stringify(jsonResult, undefined, 2)}\n`);

        if (options.exitCode && jsonResult.summary.issues > 0) {
            process.exitCode = 1;
        }

        return;
    }

    // 6. Human-readable output
    if (filtered.length === 0) {
        success(`No security issues found across ${String(installed.length)} packages.`);

        return;
    }

    // Group vulnerabilities by severity
    const vulnsBySeverity: Record<string, { entry: AuditEntry; vuln: SecurityVulnerability }[]> = {
        CRITICAL: [],
        HIGH: [],
        LOW: [],
        MODERATE: [],
    };

    for (const entry of filtered) {
        for (const vuln of entry.vulnerabilities) {
            if (severityPassesFilter(vuln.severity, severityFilter)) {
                const key = vuln.severity === "UNKNOWN" ? "LOW" : vuln.severity;

                vulnsBySeverity[key]?.push({ entry, vuln });
            }
        }
    }

    // Print vulnerabilities
    let totalVulns = 0;
    let acknowledgedVulns = 0;

    for (const severity of ["CRITICAL", "HIGH", "MODERATE", "LOW"] as const) {
        const items = vulnsBySeverity[severity];

        if (!items || items.length === 0) {
            continue;
        }

        info(`\n── ${severity} (${String(items.length)}) ──`);

        for (const { entry, vuln } of items) {
            const isExcluded = Boolean(entry.acceptedRisk) || isAdvisoryExcluded(vuln.id, nativeExclusions, vuln.aliases);

            if (isExcluded) {
                acknowledgedVulns++;

                if (!showAccepted) {
                    continue;
                }
            }

            totalVulns++;
            info(formatVulnLine(entry.name, entry.version, vuln, isExcluded));

            if (showFixes && (vuln.fixedVersions ?? []).length > 0) {
                note(`    Fix: update to ${vuln.fixedVersions.at(-1)}`);
            }
        }
    }

    // Print Socket.dev supply chain issues
    const socketIssues = filtered.filter(
        (e) => e.socketReport && (e.socketReport.score.overall < DEFAULT_LOW_SCORE_THRESHOLD || e.socketReport.alerts.length > 0),
    );

    if (socketIssues.length > 0) {
        info(`\n── Socket.dev Supply Chain (${String(socketIssues.length)}) ──`);

        for (const entry of socketIssues) {
            if (!entry.socketReport) {
                continue;
            }

            const isExcluded = Boolean(entry.acceptedRisk);

            if (isExcluded && !showAccepted) {
                continue;
            }

            info(formatSocketLine(entry.socketReport, isExcluded));

            for (const alert of entry.socketReport.alerts) {
                const alertColorFunction = SOCKET_ALERT_COLORS[alert.severity] ?? dim;

                info(`    ${alertColorFunction(`[${alert.severity.toUpperCase()}]`)} ${alert.type} — ${alert.category}`);
            }
        }
    }

    // Print duplicate dependencies
    if (duplicates.length > 0) {
        info(`\n── Duplicate Dependencies (${String(duplicates.length)}) ──`);

        for (const dup of duplicates) {
            const versionList = dup.versions.join(", ");

            info(`  ${dup.name} — ${String(dup.versions.length)} versions: ${yellow(versionList)}`);
        }
    }

    // Summary
    const isEntryExcluded = (e: AuditEntry): boolean =>
        Boolean(e.acceptedRisk) || (e.vulnerabilities.length > 0 && e.vulnerabilities.every((v) => isAdvisoryExcluded(v.id, nativeExclusions, v.aliases)));
    const unacknowledgedCount = filtered.filter((e) => !isEntryExcluded(e)).length;

    info("");
    info(`─ Audit Summary`);
    info(`  ${String(installed.length)} packages scanned`);

    if (nativeExclusions.ignoredAdvisories.length > 0) {
        info(
            `  ${String(nativeExclusions.ignoredAdvisories.length)} ${pm.name} audit exclusion${nativeExclusions.ignoredAdvisories.length === 1 ? "" : "s"} applied`,
        );
    }

    if (totalVulns > 0) {
        const critCount = vulnsBySeverity.CRITICAL?.filter((i) => !isEntryExcluded(i.entry)).length ?? 0;
        const highCount = vulnsBySeverity.HIGH?.filter((i) => !isEntryExcluded(i.entry)).length ?? 0;

        errorOutput(`  ${String(totalVulns)} vulnerabilit${totalVulns === 1 ? "y" : "ies"} found`);

        if (critCount > 0) {
            errorOutput(`    ${String(critCount)} critical`);
        }

        if (highCount > 0) {
            warn(`    ${String(highCount)} high`);
        }
    } else {
        success("  No vulnerabilities found");
    }

    if (socketIssues.length > 0) {
        const unacknowledgedSocket = socketIssues.filter((e) => !isEntryExcluded(e)).length;

        warn(`  ${String(unacknowledgedSocket)} package${unacknowledgedSocket === 1 ? "" : "s"} with Socket.dev supply chain issues`);
    }

    if (duplicates.length > 0) {
        warn(`  ${String(duplicates.length)} package${duplicates.length === 1 ? "" : "s"} with duplicate versions`);
        note("  Run 'vis dedupe' or your package manager's dedupe command to reduce duplicates.");
    }

    if (acknowledgedVulns > 0) {
        info(`  ${String(acknowledgedVulns)} acknowledged (accepted risks)`);

        if (!showAccepted) {
            note("  Use --show-accepted to see acknowledged issues.");
        }
    }

    if (unacknowledgedCount === 0) {
        success("\n  All issues are acknowledged. No action required.");
    }

    // Sync accepted risks to native PM config
    if (options.sync && acceptedRisks) {
        // Collect CVE/GHSA IDs from ALL accepted entries (not just severity-filtered)
        const idSet = new Set<string>();

        for (const entry of entries) {
            if (entry.acceptedRisk) {
                for (const vuln of entry.vulnerabilities) {
                    if (vuln.id.startsWith("CVE-") || vuln.id.startsWith("GHSA-")) {
                        idSet.add(vuln.id);
                    }

                    // Also include aliases (CVE/GHSA variants)
                    if (vuln.aliases) {
                        for (const alias of vuln.aliases) {
                            if (alias.startsWith("CVE-") || alias.startsWith("GHSA-")) {
                                idSet.add(alias);
                            }
                        }
                    }
                }
            }
        }

        const advisoryIds = [...idSet];

        if (advisoryIds.length > 0) {
            info("");
            const actions = syncAcceptedRisksToNativeConfig(pm.name, workspaceRoot, advisoryIds);

            for (const action of actions) {
                success(`  ${action}`);
            }
        } else {
            info("\nNo advisory IDs to sync to native PM config.");
        }
    }

    if (options.exitCode && unacknowledgedCount > 0) {
        process.exitCode = 1;
    }
};

const execute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, AuditOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    await executeAudit(wsRoot, options, visConfig, logger);
};

export default execute as CommandExecute<Toolbox>;
