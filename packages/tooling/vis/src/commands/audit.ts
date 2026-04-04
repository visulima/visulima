import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { join } from "@visulima/path";

import type { SecurityVulnerability } from "../catalog";
import { fetchVulnerabilities } from "../catalog";
import { error as errorOutput, info, note, success, warn } from "../output";
import type { AcceptedRisk, PackageReportData } from "../socket-security";
import { buildSocketOptions, fetchSocketReports, findAcceptedRisk, scoreLabel } from "../socket-security";

// ── Types ───────────────────────────────────────────────────────────

interface InstalledPackage {
    isDev: boolean;
    name: string;
    version: string;
}

interface AuditEntry {
    acceptedRisk?: AcceptedRisk;
    name: string;
    socketReport?: PackageReportData;
    version: string;
    vulnerabilities: SecurityVulnerability[];
}

type SeverityFilter = "critical" | "high" | "low" | "medium";

// ── Package discovery ───────────────────────────────────────────────

const scanInstalledPackages = (workspaceRoot: string): InstalledPackage[] => {
    const nodeModulesPath = join(workspaceRoot, "node_modules");

    if (!existsSync(nodeModulesPath)) {
        return [];
    }

    const packages: InstalledPackage[] = [];

    // Read root package.json to determine dev vs prod
    const rootPkgPath = join(workspaceRoot, "package.json");
    let devDeps = new Set<string>();

    if (existsSync(rootPkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(rootPkgPath, "utf8")) as {
                devDependencies?: Record<string, string>;
            };

            devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));
        } catch {
            // Non-critical
        }
    }

    const scanDir = (dir: string, prefix: string): void => {
        let entries: string[];

        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }

        for (const entry of entries) {
            if (entry.startsWith(".")) {
                continue;
            }

            const fullPath = join(dir, entry);

            if (entry.startsWith("@")) {
                scanDir(fullPath, `${entry}/`);
                continue;
            }

            const pkgName = prefix + entry;
            const pkgJsonPath = join(fullPath, "package.json");

            try {
                if (!statSync(fullPath).isDirectory() || !existsSync(pkgJsonPath)) {
                    continue;
                }

                const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { version?: string };

                if (pkg.version) {
                    packages.push({
                        isDev: devDeps.has(pkgName),
                        name: pkgName,
                        version: pkg.version,
                    });
                }
            } catch {
                // Skip unreadable packages
            }
        }
    };

    scanDir(nodeModulesPath, "");

    return packages;
};

// ── Severity helpers ────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MODERATE: 2,
    LOW: 3,
    UNKNOWN: 4,
};

const SOCKET_SEVERITY_ORDER: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

const severityPassesFilter = (severity: string, filter: SeverityFilter): boolean => {
    const filterLevel = SEVERITY_ORDER[filter.toUpperCase()] ?? SEVERITY_ORDER.MODERATE ?? 2;
    const vulnLevel = SEVERITY_ORDER[severity.toUpperCase()] ?? 4;

    return vulnLevel <= filterLevel;
};

// ── Display helpers ─────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: "\u001B[31m",
    HIGH: "\u001B[35m",
    LOW: "\u001B[36m",
    MODERATE: "\u001B[33m",
    UNKNOWN: "\u001B[90m",
};

const RESET = "\u001B[0m";

const formatVulnLine = (name: string, version: string, vuln: SecurityVulnerability, isAccepted: boolean): string => {
    const color = SEVERITY_COLORS[vuln.severity] ?? SEVERITY_COLORS.UNKNOWN;
    const badge = isAccepted ? " \u001B[90m[acknowledged]\u001B[0m" : "";
    const fixed = vuln.fixedVersions.length > 0 ? ` (fix: ${vuln.fixedVersions.join(", ")})` : "";

    return `  ${color ?? ""}${vuln.severity}${RESET} ${vuln.id} — ${name}@${version}${badge}\n    ${vuln.summary}${fixed}`;
};

const formatSocketLine = (report: PackageReportData, isAccepted: boolean): string => {
    const name = report.namespace ? `${report.namespace}/${report.name}` : report.name;
    const pct = `${String(Math.round(report.score.overall * 100))}%`;
    const badge = isAccepted ? " \u001B[90m[acknowledged]\u001B[0m" : "";
    const alerts = report.alerts.length > 0
        ? `, ${String(report.alerts.length)} alert${report.alerts.length === 1 ? "" : "s"}`
        : "";

    return `  ${pct} ${name}@${report.version} (${scoreLabel(report.score.overall)}${alerts})${badge}`;
};

// ── Main audit logic ────────────────────────────────────────────────

/* eslint-disable sonarjs/cognitive-complexity -- audit command with multiple output paths */
const executeAudit = async (
    workspaceRoot: string,
    options: Record<string, unknown>,
    visConfig: Record<string, unknown> | undefined,
    logger: Console,
): Promise<void> => {
    const severityFilter = (options.severity as SeverityFilter | undefined) ?? "low";
    const isJson = Boolean(options.json);
    const showFixes = Boolean(options.fix);
    const showAccepted = Boolean(options["show-accepted"]);
    const socketConfig = (visConfig as { security?: { socket?: Record<string, unknown> } } | undefined)?.security?.socket;
    const acceptedRisks = socketConfig?.acceptedRisks as Record<string, AcceptedRisk> | undefined;

    // 1. Discover installed packages
    info("Scanning installed packages...");

    const installed = scanInstalledPackages(workspaceRoot);

    if (installed.length === 0) {
        info("No packages found in node_modules. Run your package manager's install command first.");

        return;
    }

    info(`Found ${String(installed.length)} packages.\n`);

    // 2. Fetch vulnerability and security data in parallel
    const packagesToScan = installed.map((p) => ({ name: p.name, version: p.version }));

    const socketOpts = buildSocketOptions(socketConfig as Record<string, unknown> | undefined);

    const [vulnMap, socketReports] = await Promise.all([
        fetchVulnerabilities(packagesToScan),
        socketOpts ? fetchSocketReports(packagesToScan, socketOpts) : Promise.resolve(new Map<string, PackageReportData>()),
    ]);

    // 3. Build audit entries
    const entries: AuditEntry[] = [];

    for (const pkg of installed) {
        const vulns = vulnMap.get(pkg.name) ?? [];
        const report = socketReports.get(`${pkg.name}@${pkg.version}`);
        const accepted = findAcceptedRisk(pkg.name, pkg.version, acceptedRisks);

        const hasVulns = vulns.length > 0;
        const hasLowScore = report ? report.score.overall < 0.4 : false;
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
        const lowScorePasses = entry.socketReport && entry.socketReport.score.overall < 0.4;

        return vulnPasses || socketPasses || lowScorePasses;
    });

    // 5. JSON output
    if (isJson) {
        const jsonResult = {
            packages: installed.length,
            results: filtered.map((e) => ({
                acceptedRisk: e.acceptedRisk ?? null,
                name: e.name,
                socketScore: e.socketReport?.score.overall ?? null,
                socketAlerts: e.socketReport?.alerts ?? [],
                version: e.version,
                vulnerabilities: e.vulnerabilities,
            })),
            summary: {
                accepted: filtered.filter((e) => e.acceptedRisk).length,
                issues: filtered.filter((e) => !e.acceptedRisk).length,
                total: filtered.length,
            },
        };

        process.stdout.write(`${JSON.stringify(jsonResult, undefined, 2)}\n`);

        if (options["exit-code"] && jsonResult.summary.issues > 0) {
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

        info(`\n\u2500\u2500 ${severity} (${String(items.length)}) \u2500\u2500`);

        for (const { entry, vuln } of items) {
            const isAccepted = Boolean(entry.acceptedRisk);

            if (isAccepted) {
                acknowledgedVulns++;

                if (!showAccepted) {
                    continue;
                }
            }

            totalVulns++;
            info(formatVulnLine(entry.name, entry.version, vuln, isAccepted));

            if (showFixes && vuln.fixedVersions.length > 0) {
                note(`    Fix: update to ${vuln.fixedVersions[vuln.fixedVersions.length - 1]}`);
            }
        }
    }

    // Print Socket.dev supply chain issues
    const socketIssues = filtered.filter((e) => e.socketReport && (e.socketReport.score.overall < 0.4 || e.socketReport.alerts.length > 0));

    if (socketIssues.length > 0) {
        info(`\n\u2500\u2500 Socket.dev Supply Chain (${String(socketIssues.length)}) \u2500\u2500`);

        for (const entry of socketIssues) {
            if (!entry.socketReport) {
                continue;
            }

            const isAccepted = Boolean(entry.acceptedRisk);

            if (isAccepted && !showAccepted) {
                continue;
            }

            info(formatSocketLine(entry.socketReport, isAccepted));

            for (const alert of entry.socketReport.alerts) {
                const color = SOCKET_SEVERITY_ORDER[alert.severity] !== undefined && SOCKET_SEVERITY_ORDER[alert.severity] <= 1 ? "\u001B[31m" : "\u001B[33m";

                info(`    ${color}[${alert.severity.toUpperCase()}]${RESET} ${alert.type} — ${alert.category}`);
            }
        }
    }

    // Summary
    const unacknowledgedCount = filtered.filter((e) => !e.acceptedRisk).length;

    info("");
    info(`\u2500 Audit Summary`);
    info(`  ${String(installed.length)} packages scanned`);

    if (totalVulns > 0) {
        const critCount = vulnsBySeverity.CRITICAL?.filter((i) => !i.entry.acceptedRisk).length ?? 0;
        const highCount = vulnsBySeverity.HIGH?.filter((i) => !i.entry.acceptedRisk).length ?? 0;

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
        const unacknowledgedSocket = socketIssues.filter((e) => !e.acceptedRisk).length;

        warn(`  ${String(unacknowledgedSocket)} package${unacknowledgedSocket === 1 ? "" : "s"} with Socket.dev supply chain issues`);
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

    if (options["exit-code"] && unacknowledgedCount > 0) {
        process.exitCode = 1;
    }
};
/* eslint-enable sonarjs/cognitive-complexity */

// ── Command ─────────────────────────────────────────────────────────

const audit: Command = {
    description: "Audit installed packages for vulnerabilities and supply chain risks",
    examples: [
        ["vis audit", "Full audit of all installed packages"],
        ["vis audit --severity high", "Show only high/critical issues"],
        ["vis audit --json", "Output as JSON for CI integration"],
        ["vis audit --fix", "Show fix suggestions for vulnerabilities"],
        ["vis audit --exit-code", "Exit with code 1 if issues found (for CI)"],
        ["vis audit --show-accepted", "Include acknowledged risks in output"],
    ],
    execute: async ({ logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        await executeAudit(wsRoot, options, visConfig, logger);
    },
    name: "audit",
    options: [
        {
            description: "Minimum severity to report: low, medium, high, critical (default: low)",
            name: "severity",
            type: String,
        },
        {
            defaultValue: false,
            description: "Output results as JSON",
            name: "json",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Show fix suggestions for vulnerabilities",
            name: "fix",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Exit with code 1 if unacknowledged issues found (for CI)",
            name: "exit-code",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Include acknowledged (accepted risk) issues in output",
            name: "show-accepted",
            type: Boolean,
        },
    ],
};

export default audit;
