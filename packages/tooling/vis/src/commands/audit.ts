import { readdirSync, statSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import colorize from "@visulima/colorize";

const { cyan, dim, magenta, red, yellow } = colorize;
import { isAccessibleSync, readFileSync, readJsonSync } from "@visulima/fs";
import type { LockFileType } from "@visulima/package";
import { parseLockFileContent } from "@visulima/package";
import { join } from "@visulima/path";

import { isAdvisoryExcluded, isPackageExcluded, readNativeAuditExclusions, syncAcceptedRisksToNativeConfig } from "../audit-config";
import type { SecurityVulnerability } from "../catalog";
import { fetchVulnerabilities } from "../catalog";
import { error as errorOutput, info, note, success, warn } from "../output";
import { detectPm } from "../pm-runner";
import type { AcceptedRisk, PackageReportData } from "../socket-security";
import { buildSocketOptions, DEFAULT_LOW_SCORE_THRESHOLD, fetchSocketReports, findAcceptedRisk, getFullPackageName, scoreLabel } from "../socket-security";
import type { VisConfig } from "../workspace";

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

/** A package installed in multiple versions. */
interface DuplicatePackage {
    /** The package name. */
    name: string;
    /** Each installed version. */
    versions: string[];
}

// ── Package discovery ───────────────────────────────────────────────

const scanInstalledPackages = (workspaceRoot: string): InstalledPackage[] => {
    const nodeModulesPath = join(workspaceRoot, "node_modules");

    if (!isAccessibleSync(nodeModulesPath)) {
        return [];
    }

    const packages: InstalledPackage[] = [];

    // Read root package.json to determine dev vs prod
    const rootPkgPath = join(workspaceRoot, "package.json");
    let devDeps = new Set<string>();

    if (isAccessibleSync(rootPkgPath)) {
        try {
            const pkg = readJsonSync(rootPkgPath) as {
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
                if (!statSync(fullPath).isDirectory() || !isAccessibleSync(pkgJsonPath)) {
                    continue;
                }

                const pkg = readJsonSync(pkgJsonPath) as { version?: string };

                if (pkg.version) {
                    packages.push({
                        isDev: devDeps.has(pkgName),
                        name: pkgName,
                        version: pkg.version,
                    });
                }

                // Recurse into nested node_modules (npm non-flat installs)
                const nestedNm = join(fullPath, "node_modules");

                if (isAccessibleSync(nestedNm)) {
                    scanDir(nestedNm, "");
                }
            } catch {
                // Skip unreadable packages
            }
        }
    };

    scanDir(nodeModulesPath, "");

    return packages;
};

// ── Duplicate dependency detection ──────────────────────────────────

const LOCKFILE_NAMES: Record<string, { file: string; type: LockFileType }> = {
    bun: { file: "bun.lock", type: "bun" },
    npm: { file: "package-lock.json", type: "npm" },
    pnpm: { file: "pnpm-lock.yaml", type: "pnpm" },
    yarn: { file: "yarn.lock", type: "yarn" },
};

/**
 * Finds packages with multiple installed versions by parsing the
 * workspace lockfile via `@visulima/package`.
 */
const findDuplicateDependencies = (workspaceRoot: string, pmName: string): DuplicatePackage[] => {
    const lockInfo = LOCKFILE_NAMES[pmName];

    if (!lockInfo) {
        return [];
    }

    let lockContent: string;

    try {
        lockContent = readFileSync(join(workspaceRoot, lockInfo.file));
    } catch {
        return [];
    }

    const entries = parseLockFileContent(lockContent, lockInfo.type);

    if (entries.length === 0) {
        return [];
    }

    const versionMap = new Map<string, Set<string>>();

    for (const entry of entries) {
        if (!versionMap.has(entry.name)) {
            versionMap.set(entry.name, new Set());
        }

        versionMap.get(entry.name)!.add(entry.version);
    }

    const duplicates: DuplicatePackage[] = [];

    for (const [name, versions] of versionMap) {
        if (versions.size <= 1) {
            continue;
        }

        duplicates.push({ name, versions: [...versions] });
    }

    return duplicates.sort((a, b) => a.name.localeCompare(b.name));
};

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

    // 1. Discover installed packages
    info("Scanning installed packages...");

    const installed = scanInstalledPackages(workspaceRoot);

    if (installed.length === 0) {
        info("No packages found in node_modules. Run your package manager's install command first.");

        return;
    }

    info(`Found ${String(installed.length)} packages.\n`);

    // 2. Fetch vulnerability and security data in parallel
    const packagesToScan = installed.map((p) => {
        return { name: p.name, version: p.version };
    });

    const socketOptions = buildSocketOptions(socketConfig);

    // findDuplicateDependencies is synchronous — hoist it outside Promise.all
    // so the async fan-out only contains genuine async work.
    const duplicates = findDuplicateDependencies(workspaceRoot, pm.name);

    const [vulnMap, socketReports] = await Promise.all([
        fetchVulnerabilities(packagesToScan),
        socketOptions ? fetchSocketReports(packagesToScan, socketOptions) : Promise.resolve(new Map<string, PackageReportData>()),
    ]);

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

        info(`\n\u2500\u2500 ${severity} (${String(items.length)}) \u2500\u2500`);

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
        info(`\n\u2500\u2500 Socket.dev Supply Chain (${String(socketIssues.length)}) \u2500\u2500`);

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
        info(`\n\u2500\u2500 Duplicate Dependencies (${String(duplicates.length)}) \u2500\u2500`);

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
    info(`\u2500 Audit Summary`);
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

// ── Command ─────────────────────────────────────────────────────────

const audit: Command = {
    description: "Audit installed packages for vulnerabilities and supply chain risks",
    examples: [
        ["vis audit", "Full audit of all installed packages"],
        ["vis audit --severity high", "Show only high/critical issues"],
        ["vis audit --format json", "Output as JSON for CI integration"],
        ["vis audit --fix", "Show fix suggestions for vulnerabilities"],
        ["vis audit --exit-code", "Exit with code 1 if issues found (for CI)"],
        ["vis audit --show-accepted", "Include acknowledged risks in output"],
        ["vis audit --sync", `Sync accepted risks to native PM config (pnpm-workspace.yaml / .yarnrc.yml)`],
    ],
    execute: async ({ logger, options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
        }

        await executeAudit(wsRoot, options, visConfig, logger);
    },
    group: "Security & Health",
    name: "audit",
    options: [
        {
            description: "Minimum severity to report: low, medium, high, critical (default: low)",
            name: "severity",
            type: String,
        },
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Show fix suggestions for vulnerabilities",
            name: "fix",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Exit with code 1 if any issues found (for CI)",
            name: "exit-code",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Include acknowledged (accepted risk) issues in output",
            name: "show-accepted",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Sync vis accepted risks to native PM config (pnpm-workspace.yaml / .yarnrc.yml)",
            name: "sync",
            type: Boolean,
        },
    ],
};

export default audit;
export type { DuplicatePackage, InstalledPackage };
export { findDuplicateDependencies, scanInstalledPackages };
