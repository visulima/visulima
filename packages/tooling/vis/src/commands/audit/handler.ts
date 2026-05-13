import { existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { cyan, dim, magenta, red, yellow } from "@visulima/colorize";
import { resolve as resolvePath } from "@visulima/path";
import isInCi from "is-in-ci";

import { isAdvisoryExcluded, isPackageExcluded, readNativeAuditExclusions, syncAcceptedRisksToNativeConfig } from "../../config/audit-config";
import type { VisConfig } from "../../config/workspace";
import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { pail } from "../../io/logger";
import { detectPm, runAdd } from "../../pm/pm-runner";
import { emitAuditHtml } from "../../report/audit-html";
import { emitCsaf } from "../../report/csaf";
import { emitCycloneDxVex } from "../../report/cyclonedx-vex";
import { emitSarif } from "../../report/sarif";
import { buildCycloneDxBom } from "../../sbom/cyclonedx";
import { startScanProgress } from "../../scan/scan-progress";
import { AdvisoryDbNotFoundError, queryAdvisories, resolveAdvisoryDbPath } from "../../security/advisories";
import type { DirectApplyPlan } from "../../security/apply-direct";
import { buildDirectApplyPlan, formatDirectApplyPlan } from "../../security/apply-direct";
import { findDuplicateDependencies, lockedPackages } from "../../security/dependency-scan";
import { readNodeModulesManifests } from "../../security/manifests";
import { isMarshallDisabled } from "../../security/marshalls/registry";
import { canonicalEcosystem, lockedPackagesForEcosystem } from "../../security/multi-eco-lockfiles";
import type { PolicyDecision } from "../../security/policies";
import { evaluatePolicies, getRegisteredPolicyNames, parsePoliciesFlag } from "../../security/policies";
import { computeReachableVulnerablePackages } from "../../security/reachability";
import type { SeverityFilter } from "../../security/severity";
import { severityPassesFilter } from "../../security/severity";
import type { AcceptedRisk, PackageReportData } from "../../security/socket-security";
import {
    buildSocketOptions,
    DEFAULT_LOW_SCORE_THRESHOLD,
    fetchSocketReports,
    findAcceptedRisk,
    getFullPackageName,
    scoreLabel,
} from "../../security/socket-security";
import { applyOverridePlan, buildOverridePlanFromFindings, planOverrideWrite } from "../../security/transitive-fix";
import type { SecurityVulnerability } from "../../util/catalog";
import { fetchVulnerabilities } from "../../util/catalog";
import type { AuditOptions } from "./index";

interface AuditEntry {
    acceptedRisk?: AcceptedRisk;
    name: string;
    socketReport?: PackageReportData;
    version: string;
    vulnerabilities: SecurityVulnerability[];
}

const SOCKET_ALERT_COLORS: Record<string, (s: string) => string> = {
    critical: red,
    high: magenta,
    low: cyan,
    medium: yellow,
};

//
// `--ecosystem npm,pypi,maven,...` accepts a comma list. Each ecosystem
// has its own Rust range matcher and lockfile reader; unknown values
// (or ones whose matcher hasn't landed yet) get a non-fatal warning so
// CI invocations stay stable as more ecosystems land.
const SUPPORTED_ECOSYSTEMS = new Set(["cargo", "crates.io", "go", "maven", "npm", "pypi", "rubygems"]);

// Parses `--ecosystem` (comma-separated) into the canonical list plus any
// entries that don't match SUPPORTED_ECOSYSTEMS — the handler emits a
// non-fatal warning for unsupported names instead of failing.
const parseEcosystems = (raw: string | undefined): { all: string[]; unsupported: string[] } => {
    const list = (raw ?? "npm")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const all = list.length > 0 ? list : ["npm"];
    const unsupported = all.filter((eco) => !SUPPORTED_ECOSYSTEMS.has(eco.toLowerCase()));

    return { all, unsupported };
};

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

const executeAudit = async (workspaceRoot: string, options: Record<string, unknown>, visConfig: VisConfig | undefined, _logger: Console): Promise<void> => {
    const severityFilter = (options.severity as SeverityFilter | undefined) ?? "low";
    const format = (options.format as string | undefined) ?? "table";
    const isSarif = format === "sarif";
    const isCsaf = format === "csaf";
    const isCycloneDxVex = format === "cyclonedx-vex" || format === "cyclonedx";
    const isJson = format === "json" || Boolean(options.json);
    const reportPath = options.report as string | undefined;
    const auditConfig = visConfig?.security?.audit;
    const policies = visConfig?.security?.policies;
    const isOffline = options.offline === undefined ? Boolean(auditConfig?.offlineByDefault) : Boolean(options.offline);
    const dbPath = options.db as string | undefined;
    const ecosystems = parseEcosystems(options.ecosystem as string | undefined);
    const prodOnly = Boolean(options.prodOnly);
    const failOn = (options.failOn as SeverityFilter | undefined) ?? policies?.vulnerability?.failOn;
    const showFixes = Boolean(options.showFixes);
    const showAccepted = Boolean(options.showAccepted);
    const socketConfig = visConfig?.security?.socket;
    const acceptedRisks = visConfig?.security?.acceptedRisks;
    // --no-usage wins over --usage and config; otherwise --usage flag, else config default.
    const usageConfig = policies?.vulnerability?.usage;
    const usageEnabled = options.noUsage ? false : options.usage === undefined ? Boolean(usageConfig?.enabled) : Boolean(options.usage);
    const quietHeader = isJson || isSarif || isCsaf || isCycloneDxVex;

    // Read native PM audit exclusions
    const pm = detectPm(workspaceRoot);
    const nativeExclusions = readNativeAuditExclusions(workspaceRoot, pm.name);

    // Offline mode requires a local DB. Fail early with a clear message instead
    // of silently degrading to "no findings" — the latter is exactly the
    // network-flakiness footgun this whole flow is meant to avoid.
    if (isOffline) {
        const resolvedDb = dbPath ?? resolveAdvisoryDbPath(workspaceRoot);

        if (!existsSync(resolvedDb)) {
            const error = new AdvisoryDbNotFoundError(resolvedDb);

            if (quietHeader) {
                process.stderr.write(`${error.message}\n`);
            } else {
                pail.error(error.message);
            }

            process.exitCode = 1;

            return;
        }
    }

    if (!quietHeader && (nativeExclusions.ignoredAdvisories.length > 0 || nativeExclusions.excludedPackages.length > 0)) {
        pail.info(
            `Loaded ${String(nativeExclusions.ignoredAdvisories.length)} ignored advisor${nativeExclusions.ignoredAdvisories.length === 1 ? "y" : "ies"} and ${String(nativeExclusions.excludedPackages.length)} excluded package${nativeExclusions.excludedPackages.length === 1 ? "" : "s"} from ${pm.name} config.`,
        );
    }

    if (!quietHeader && ecosystems.unsupported.length > 0) {
        pail.warn(
            `Ecosystems ${ecosystems.unsupported.map((e) => `'${e}'`).join(", ")} are not yet supported by the audit matcher. `
            + "Supported: npm, pypi, crates.io, cargo, maven, go, rubygems.",
        );
    }

    // 1. Discover installed packages from the lockfile (single parse,
    // no recursive node_modules walk). `--prod-only` will filter dev
    // packages via the lockedPackages includeDev flag in Phase 1.7.
    const installed = lockedPackages(workspaceRoot, pm.name, { includeDev: !prodOnly });

    if (installed.length === 0) {
        pail.info(`No ${pm.name} lockfile entries found. Run ${pm.name} install first.`);

        return;
    }

    if (!quietHeader) {
        const scope = prodOnly ? "production-only packages" : "installed packages";

        pail.info(`Scanning ${String(installed.length)} ${scope}${isOffline ? " (offline)" : ""}…`);
    }

    // 2. Fetch vulnerability and security data in parallel
    const packagesToScan = installed.map((p) => {
        return { name: p.name, version: p.version };
    });

    // Offline mode skips every network-bound source; socket.dev is therefore
    // disabled regardless of socketConfig.enabled. MARSHALL_DISABLE_SOCKET
    // is the equivalent env-var escape hatch.
    const socketOptions = isOffline || isMarshallDisabled("socket") ? undefined : buildSocketOptions(socketConfig, policies?.score?.minimum);
    // Resolve the effective low-score threshold once so every filter site below
    // honours `security.policies.score.minimum` (or its default).
    const scoreMinimum = socketOptions?.minimumScore ?? policies?.score?.minimum ?? DEFAULT_LOW_SCORE_THRESHOLD;

    // findDuplicateDependencies is synchronous — hoist it outside Promise.all
    // so the async fan-out only contains genuine async work.
    const duplicates = findDuplicateDependencies(workspaceRoot, pm.name);

    // Live progress: one row per network-bound scan. JSON/SARIF consumers
    // get no progress UI (it would corrupt the output stream).
    const progressTasks = [
        { id: "vulnerabilities", label: isOffline ? "Known vulnerabilities (offline OSV cache)" : "Known vulnerabilities (OSV)" },
        ...(socketOptions ? [{ id: "socket", label: "Socket.dev supply-chain reports" }] : []),
    ];
    const progress = startScanProgress(progressTasks, { live: !quietHeader });
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

        const vulnPromise = isOffline
            ? Promise.resolve()
                .then(() =>
                    queryAdvisories(packagesToScan, {
                        dbPath,
                        ecosystem: ecosystems.all.find((e) => SUPPORTED_ECOSYSTEMS.has(e.toLowerCase())) ?? "npm",
                        workspaceRoot,
                    }),
                )
                .then((map) => {
                    let count = 0;

                    for (const list of map.values()) {
                        count += list.length;
                    }

                    progress.finish(
                        "vulnerabilities",
                        count > 0 ? "warn" : "ok",
                        count > 0 ? `${String(count)} found · ${fmtElapsed(vulnStart)}` : `none found · ${fmtElapsed(vulnStart)}`,
                    );

                    return map;
                })
                .catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : String(error);

                    progress.finish("vulnerabilities", "error", message);

                    if (error instanceof AdvisoryDbNotFoundError) {
                        // surface up — the command should exit non-zero
                        throw error;
                    }

                    return new Map<string, SecurityVulnerability[]>();
                })
            : fetchVulnerabilities(packagesToScan)
                .then((map) => {
                    let count = 0;

                    for (const list of map.values()) {
                        count += list.length;
                    }

                    progress.finish(
                        "vulnerabilities",
                        count > 0 ? "warn" : "ok",
                        count > 0 ? `${String(count)} found · ${fmtElapsed(vulnStart)}` : `none found · ${fmtElapsed(vulnStart)}`,
                    );

                    return map;
                })
                .catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : String(error);

                    progress.finish("vulnerabilities", "error", message);

                    return new Map<string, SecurityVulnerability[]>();
                });

        [vulnMap, socketReports] = await Promise.all([
            vulnPromise,
            socketOptions
                ? fetchSocketReports(packagesToScan, socketOptions)
                    .then((reports) => {
                        let alerts = 0;
                        let low = 0;

                        for (const report of reports.values()) {
                            alerts += report.alerts.length;

                            if (report.score.overall < scoreMinimum) {
                                low += 1;
                            }
                        }

                        const total = alerts + low;

                        progress.finish(
                            "socket",
                            total > 0 ? "warn" : "ok",
                            total > 0
                                ? `${String(alerts)} alert${alerts === 1 ? "" : "s"}, ${String(low)} low-score · ${fmtElapsed(socketStart)}`
                                : `clean · ${fmtElapsed(socketStart)}`,
                        );

                        return reports;
                    })
                    .catch((error: unknown) => {
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
        pail.info(dim(`Scan completed in ${fmtElapsed(startedAt)}`));
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
        const hasLowScore = report ? report.score.overall < scoreMinimum : false;
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

    // 3b. Non-npm ecosystems (offline-only — the online catalog path is
    // npm-only today). Each ecosystem owns its own lockfile reader and
    // queries the same shared advisory DB with the right ecosystem tag.
    if (isOffline) {
        const nonNpmEcosystems = ecosystems.all.filter((eco) => SUPPORTED_ECOSYSTEMS.has(eco.toLowerCase()) && eco.toLowerCase() !== "npm");

        for (const eco of nonNpmEcosystems) {
            const canonical = canonicalEcosystem(eco);
            const ecoPackages = lockedPackagesForEcosystem(workspaceRoot, canonical);

            if (ecoPackages.length === 0) {
                continue;
            }

            if (!quietHeader) {
                pail.info(dim(`Scanning ${String(ecoPackages.length)} ${canonical} packages…`));
            }

            try {
                const ecoVulnMap = queryAdvisories(
                    ecoPackages.map((p) => { return { name: p.name, version: p.version }; }),
                    { dbPath, ecosystem: canonical, workspaceRoot },
                );

                for (const pkg of ecoPackages) {
                    const vulns = ecoVulnMap.get(pkg.name) ?? [];

                    if (vulns.length === 0) {
                        continue;
                    }

                    entries.push({
                        acceptedRisk: findAcceptedRisk(pkg.name, pkg.version, acceptedRisks),
                        name: pkg.name,
                        version: pkg.version,
                        vulnerabilities: vulns,
                    });
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);

                pail.warn(`Failed to scan ${canonical}: ${message}`);
            }
        }
    }

    // 4. Filter by severity
    let filtered = entries.filter((entry) => {
        const vulnPasses = entry.vulnerabilities.some((v) => severityPassesFilter(v.severity, severityFilter));
        const socketPasses = entry.socketReport?.alerts.some((a) =>
            severityPassesFilter(a.severity === "medium" ? "MODERATE" : a.severity.toUpperCase(), severityFilter),
        );
        const lowScorePasses = entry.socketReport && entry.socketReport.score.overall < scoreMinimum;

        return vulnPasses || socketPasses || lowScorePasses;
    });

    // 4a. Unified policy engine. The four offline-clean policies
    // (license, install_scripts, vulnerability, unexpected_deps baseline
    // mode) run here; network-bound policies join in Phase 3. The
    // engine receives the same OSV map + Socket reports the handler
    // already built, so it never refetches anything.
    const policiesFlag = options.policies as string | undefined;
    const unknownPolicyTokens: string[] = [];
    const policyDecisions: PolicyDecision[] = await (async () => {
        const registered = getRegisteredPolicyNames();
        const registeredList = registered.map((n) => `'${n}'`).join(", ");
        const enabledPolicies = parsePoliciesFlag(policiesFlag, (unknown) => {
            unknownPolicyTokens.push(unknown);

            const message = `Unknown policy '${unknown}' — ignoring. Available: ${registeredList}.`;

            if (quietHeader) {
                // Machine-readable formats can't carry warnings inline (sarif/csaf/cyclonedx-vex
                // are schema-bound). Always emit to stderr so CI logs surface typos that
                // would otherwise silently disable enforcement.
                process.stderr.write(`vis audit: ${message}\n`);
            } else {
                pail.warn(message);
            }
        });

        if (enabledPolicies?.size === 0) {
            // `--policies none`: explicit bypass.
            return [];
        }

        // `license` is currently the only policy that reads node_modules manifests.
        // Skip the walk (thousands of `package.json` reads in a large monorepo) when
        // it isn't both configured *and* enabled.
        const licenseConfig = visConfig?.security?.policies?.license;
        const licenseConfigured = Boolean(licenseConfig && ((licenseConfig.allow?.length ?? 0) > 0 || (licenseConfig.deny?.length ?? 0) > 0));
        const licenseEnabled = enabledPolicies === undefined || enabledPolicies.has("license");
        const manifestData = licenseConfigured && licenseEnabled ? readNodeModulesManifests(workspaceRoot) : undefined;

        return evaluatePolicies(
            {
                manifestData,
                offline: isOffline,
                osvFindings: vulnMap,
                packageManager: pm.name,
                packages: installed,
                socketReports,
                workspaceRoot,
            },
            "audit",
            { enabledPolicies, visConfig: visConfig ?? {} },
        );
    })();

    // 4b. Reachability filter (`--usage` / `security.audit.usage.enabled`).
    // Drop entries whose vulnerable package isn't statically imported anywhere
    // in the workspace. `alwaysAssumeUsed` is the escape hatch for build-time
    // loaders that the regex scan can't see.
    if (usageEnabled) {
        const vulnerableNames = new Set(filtered.filter((e) => e.vulnerabilities.length > 0).map((e) => e.name));
        const reachResult = computeReachableVulnerablePackages({
            alwaysAssumeUsed: usageConfig?.alwaysAssumeUsed,
            vulnerablePackages: vulnerableNames,
            workspaceRoot,
        });

        filtered = filtered.filter((entry) => {
            // Keep socket-only entries — reachability is a vulnerability-scoped filter.
            if (entry.vulnerabilities.length === 0) {
                return true;
            }

            return reachResult.reachable.has(entry.name);
        });

        if (!quietHeader) {
            pail.info(
                dim(
                    `Reachability filter: ${String(reachResult.reachable.size)}/${String(vulnerableNames.size)} vulnerable packages reachable (${String(reachResult.filesScanned)} files scanned).`,
                ),
            );
        }
    }

    const findingsForReport = (): {
        acknowledged: boolean;
        packageName: string;
        packageVersion: string;
        vulnerability: SecurityVulnerability;
    }[] =>
        filtered.flatMap((entry) =>
            entry.vulnerabilities.map((vuln) => {
                return {
                    acknowledged: Boolean(entry.acceptedRisk) || isAdvisoryExcluded(vuln.id, nativeExclusions, vuln.aliases),
                    packageName: entry.name,
                    packageVersion: entry.version,
                    vulnerability: vuln,
                };
            }),
        );

    const wantsFix = Boolean(options.fix);
    const wantsFixTransitive = Boolean(options.fixTransitive);
    const yes = Boolean(options.yes);
    const allowMajor = Boolean(options.allowMajor);

    if (wantsFix || wantsFixTransitive) {
        // Strip acknowledged findings before planning — accepted risks
        // should not silently auto-bump or override.
        const actionableFindings = findingsForReport().filter((f) => !f.acknowledged);

        if (wantsFix) {
            const directExit = await runApplyDirect({
                actionableFindings,
                allowMajor,
                pm,
                visConfig,
                workspaceRoot,
                yes,
            });

            if (directExit !== undefined) {
                process.exitCode = directExit;

                return;
            }
        }

        if (wantsFixTransitive) {
            const transitiveExit = await runApplyTransitive({
                actionableFindings,
                pm,
                visConfig,
                workspaceRoot,
                yes,
            });

            if (transitiveExit !== undefined) {
                process.exitCode = transitiveExit;

                return;
            }
        }
    }

    // 5a. SARIF output (CI code-scanning uploads)
    if (isSarif) {
        const sarif = emitSarif({
            findings: findingsForReport(),
            policyDecisions,
            tool: { informationUri: "https://github.com/visulima/visulima", name: "vis-audit", version: "alpha" },
            workspaceRoot,
        });

        process.stdout.write(`${JSON.stringify(sarif, undefined, 2)}\n`);

        applyExitGate(filtered, nativeExclusions, options.exitCode, failOn, policyDecisions);

        return;
    }

    // 5b. CSAF 2.0 output (enterprise vuln-management pipelines)
    if (isCsaf) {
        const csaf = emitCsaf({
            findings: findingsForReport(),
            tool: { informationUri: "https://github.com/visulima/visulima", name: "vis-audit", version: "alpha" },
            workspaceRoot,
        });

        process.stdout.write(`${JSON.stringify(csaf, undefined, 2)}\n`);

        applyExitGate(filtered, nativeExclusions, options.exitCode, failOn, policyDecisions);

        return;
    }

    // 5c. CycloneDX 1.7 + VEX (SBOM + vulnerability statement in one document)
    if (isCycloneDxVex) {
        const { packageJsons, workspace } = discoverWorkspace(workspaceRoot, visConfig);
        const projectGraph = buildProjectGraph(workspaceRoot, workspace, packageJsons);

        const bom = buildCycloneDxBom({
            includeDev: !prodOnly,
            projectGraph,
            workspace,
            workspaceRoot,
        });

        const vex = emitCycloneDxVex({ bom, findings: findingsForReport() });

        process.stdout.write(`${JSON.stringify(vex, undefined, 2)}\n`);

        applyExitGate(filtered, nativeExclusions, options.exitCode, failOn, policyDecisions);

        return;
    }

    // 5d. HTML report — writes to disk, optionally also continues the table flow below.
    if (reportPath) {
        const html = emitAuditHtml({
            findings: findingsForReport(),
            packagesScanned: installed.length,
            policyDecisions,
            tool: { name: "vis-audit", version: "alpha" },
            workspaceRoot,
        });

        const outPath = resolvePath(workspaceRoot, reportPath);

        writeFileSync(outPath, html, "utf8");

        if (!quietHeader) {
            pail.success(`HTML report written to ${outPath}`);
        }
    }

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
            policies: policyDecisions.map((d) => {
                return {
                    acceptedRisk: d.acceptedRisk ?? null,
                    data: d.data ?? null,
                    packageName: d.packageName,
                    policy: d.policy,
                    reason: d.reason,
                    severity: d.severity,
                    version: d.version,
                };
            }),
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
                policyBlocks: policyDecisions.filter((d) => d.severity === "block" && !d.acceptedRisk).length,
                policyDecisions: policyDecisions.length,
                total: filtered.length,
            },
            warnings: unknownPolicyTokens.length > 0
                ? unknownPolicyTokens.map((token) => {
                    return { kind: "unknown-policy" as const, token };
                })
                : [],
        };

        process.stdout.write(`${JSON.stringify(jsonResult, undefined, 2)}\n`);

        if (options.exitCode && (jsonResult.summary.issues > 0 || jsonResult.summary.policyBlocks > 0)) {
            process.exitCode = 1;
        }

        applyFailOnGate(filtered, nativeExclusions, failOn, policyDecisions);

        return;
    }

    // 6. Human-readable output
    if (filtered.length === 0) {
        pail.success(`No security issues found across ${String(installed.length)} packages.`);

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

        pail.info(`\n── ${severity} (${String(items.length)}) ──`);

        for (const { entry, vuln } of items) {
            const isExcluded = Boolean(entry.acceptedRisk) || isAdvisoryExcluded(vuln.id, nativeExclusions, vuln.aliases);

            if (isExcluded) {
                acknowledgedVulns++;

                if (!showAccepted) {
                    continue;
                }
            }

            totalVulns++;
            pail.info(formatVulnLine(entry.name, entry.version, vuln, isExcluded));

            if (showFixes && (vuln.fixedVersions ?? []).length > 0) {
                pail.notice(`    Fix: update to ${vuln.fixedVersions.at(-1)}`);
            }
        }
    }

    // Print Socket.dev supply chain issues
    const socketIssues = filtered.filter(
        (e) => e.socketReport && (e.socketReport.score.overall < scoreMinimum || e.socketReport.alerts.length > 0),
    );

    if (socketIssues.length > 0) {
        pail.info(`\n── Socket.dev Supply Chain (${String(socketIssues.length)}) ──`);

        for (const entry of socketIssues) {
            if (!entry.socketReport) {
                continue;
            }

            const isExcluded = Boolean(entry.acceptedRisk);

            if (isExcluded && !showAccepted) {
                continue;
            }

            pail.info(formatSocketLine(entry.socketReport, isExcluded));

            for (const alert of entry.socketReport.alerts) {
                const alertColorFunction = SOCKET_ALERT_COLORS[alert.severity] ?? dim;

                pail.info(`    ${alertColorFunction(`[${alert.severity.toUpperCase()}]`)} ${alert.type} — ${alert.category}`);
            }
        }
    }

    // Print duplicate dependencies
    if (duplicates.length > 0) {
        pail.info(`\n── Duplicate Dependencies (${String(duplicates.length)}) ──`);

        for (const dup of duplicates) {
            const versionList = dup.versions.join(", ");

            pail.info(`  ${dup.name} — ${String(dup.versions.length)} versions: ${yellow(versionList)}`);
        }
    }

    // Print policy decisions. Non-vulnerability policies always render here.
    // Vulnerability-policy decisions normally appear in the vulnerability
    // section above (avoiding double reporting), BUT when --severity hides a
    // finding while --fail-on still gates on it, the user would otherwise
    // exit 1 with no visible explanation. Surface block-severity vuln
    // policy decisions here so the gate is always visible.
    const shownVulnIds = new Set<string>();

    for (const severity of ["CRITICAL", "HIGH", "MODERATE", "LOW"] as const) {
        const items = vulnsBySeverity[severity];

        if (!items) {
            continue;
        }

        for (const { vuln } of items) {
            shownVulnIds.add(vuln.id);
        }
    }

    const renderablePolicyDecisions = policyDecisions.filter((d) => {
        if (d.policy !== "vulnerability") {
            return true;
        }

        // Surface vulnerability blocks that were masked by --severity.
        const advisoryId = typeof d.data?.advisoryId === "string" ? d.data.advisoryId : undefined;

        return d.severity === "block" && advisoryId !== undefined && !shownVulnIds.has(advisoryId);
    });

    if (renderablePolicyDecisions.length > 0) {
        pail.info(`\n── Policy Decisions (${String(renderablePolicyDecisions.length)}) ──`);

        for (const decision of renderablePolicyDecisions) {
            const isAccepted = Boolean(decision.acceptedRisk);

            if (isAccepted && !showAccepted) {
                continue;
            }

            const colorFunction = decision.severity === "block" ? red : decision.severity === "warn" ? yellow : dim;
            const badge = isAccepted ? ` ${dim("[acknowledged]")}` : "";

            pail.info(`  ${colorFunction(`[${decision.severity}]`)} ${decision.policy} — ${decision.reason}${badge}`);
        }
    }

    // Summary
    const isEntryExcluded = (e: AuditEntry): boolean =>
        Boolean(e.acceptedRisk) || (e.vulnerabilities.length > 0 && e.vulnerabilities.every((v) => isAdvisoryExcluded(v.id, nativeExclusions, v.aliases)));
    const unacknowledgedCount = filtered.filter((e) => !isEntryExcluded(e)).length;

    pail.info("");
    pail.info(`─ Audit Summary`);
    pail.info(`  ${String(installed.length)} packages scanned`);

    if (nativeExclusions.ignoredAdvisories.length > 0) {
        pail.info(
            `  ${String(nativeExclusions.ignoredAdvisories.length)} ${pm.name} audit exclusion${nativeExclusions.ignoredAdvisories.length === 1 ? "" : "s"} applied`,
        );
    }

    if (totalVulns > 0) {
        const critCount = vulnsBySeverity.CRITICAL?.filter((i) => !isEntryExcluded(i.entry)).length ?? 0;
        const highCount = vulnsBySeverity.HIGH?.filter((i) => !isEntryExcluded(i.entry)).length ?? 0;

        pail.error(`  ${String(totalVulns)} vulnerabilit${totalVulns === 1 ? "y" : "ies"} found`);

        if (critCount > 0) {
            pail.error(`    ${String(critCount)} critical`);
        }

        if (highCount > 0) {
            pail.warn(`    ${String(highCount)} high`);
        }
    } else {
        pail.success("  No vulnerabilities found");
    }

    if (socketIssues.length > 0) {
        const unacknowledgedSocket = socketIssues.filter((e) => !isEntryExcluded(e)).length;

        pail.warn(`  ${String(unacknowledgedSocket)} package${unacknowledgedSocket === 1 ? "" : "s"} with Socket.dev supply chain issues`);
    }

    if (duplicates.length > 0) {
        pail.warn(`  ${String(duplicates.length)} package${duplicates.length === 1 ? "" : "s"} with duplicate versions`);
        pail.notice("  Run 'vis dedupe' or your package manager's dedupe command to reduce duplicates.");
    }

    const blockingPolicyDecisions = policyDecisions.filter((d) => d.severity === "block" && !d.acceptedRisk);

    if (blockingPolicyDecisions.length > 0) {
        pail.error(`  ${String(blockingPolicyDecisions.length)} policy block${blockingPolicyDecisions.length === 1 ? "" : "s"}`);
    }

    if (acknowledgedVulns > 0) {
        pail.info(`  ${String(acknowledgedVulns)} acknowledged (accepted risks)`);

        if (!showAccepted) {
            pail.notice("  Use --show-accepted to see acknowledged issues.");
        }
    }

    if (unacknowledgedCount === 0) {
        pail.success("\n  All issues are acknowledged. No action required.");
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
            pail.info("");
            const actions = syncAcceptedRisksToNativeConfig(pm.name, workspaceRoot, advisoryIds);

            for (const action of actions) {
                pail.success(`  ${action}`);
            }
        } else {
            pail.info("\nNo advisory IDs to sync to native PM config.");
        }
    }

    if (options.exitCode && (unacknowledgedCount > 0 || blockingPolicyDecisions.length > 0)) {
        process.exitCode = 1;
    }

    applyFailOnGate(filtered, nativeExclusions, failOn, policyDecisions);
};

const hasBlockingPolicy = (decisions: PolicyDecision[] | undefined): boolean => {
    if (!decisions || decisions.length === 0) {
        return false;
    }

    return decisions.some((d) => d.severity === "block" && !d.acceptedRisk);
};

const applyFailOnGate = (
    filtered: AuditEntry[],
    nativeExclusions: ReturnType<typeof readNativeAuditExclusions>,
    failOn: SeverityFilter | undefined,
    policyDecisions?: PolicyDecision[],
): void => {
    if (hasBlockingPolicy(policyDecisions)) {
        process.exitCode = 1;
    }

    if (!failOn) {
        return;
    }

    const triggered = filtered.some((entry) =>
        entry.vulnerabilities.some((vuln) => {
            if (Boolean(entry.acceptedRisk) || isAdvisoryExcluded(vuln.id, nativeExclusions, vuln.aliases)) {
                return false;
            }

            return severityPassesFilter(vuln.severity, failOn);
        }),
    );

    if (triggered) {
        process.exitCode = 1;
    }
};

const applyExitGate = (
    filtered: AuditEntry[],
    nativeExclusions: ReturnType<typeof readNativeAuditExclusions>,
    exitCode: unknown,
    failOn: SeverityFilter | undefined,
    policyDecisions?: PolicyDecision[],
): void => {
    if (exitCode) {
        const unacknowledged = filtered.filter(
            (entry) => !entry.acceptedRisk && entry.vulnerabilities.some((vuln) => !isAdvisoryExcluded(vuln.id, nativeExclusions, vuln.aliases)),
        );

        if (unacknowledged.length > 0 || hasBlockingPolicy(policyDecisions)) {
            process.exitCode = 1;
        }
    }

    applyFailOnGate(filtered, nativeExclusions, failOn, policyDecisions);
};

type ApplyPmInfo = ReturnType<typeof detectPm>;

interface ActionableFinding {
    acknowledged: boolean;
    packageName: string;
    packageVersion: string;
    vulnerability: SecurityVulnerability;
}

// Reads a yes/no answer from stdin. In non-TTY contexts (CI, piped stdin)
// the prompt is skipped and `defaultYes` is returned so apply loops behave
// the same as if the user had pressed Enter.
const promptYesNo = async (question: string, defaultYes: boolean): Promise<boolean> => {
    if (!process.stdin.isTTY) {
        return defaultYes;
    }

    const rl = createInterface({ input: process.stdin, output: process.stderr });

    try {
        const hint = defaultYes ? "[Y/n]" : "[y/N]";
        const answer: string = await new Promise((resolve) => {
            rl.question(`${question} ${dim(hint)} `, (a) => {
                resolve(a.trim());
            });
        });

        if (answer.length === 0) {
            return defaultYes;
        }

        return answer.toLowerCase().startsWith("y");
    } finally {
        rl.close();
    }
};

const isTransitiveOnlyPm = (pmName: string): pmName is "bun" | "npm" | "pnpm" | "yarn" =>
    pmName === "pnpm" || pmName === "npm" || pmName === "yarn" || pmName === "bun";

interface RunApplyDirectArguments {
    actionableFindings: ActionableFinding[];
    allowMajor: boolean;
    pm: ApplyPmInfo;
    visConfig: VisConfig | undefined;
    workspaceRoot: string;
    yes: boolean;
}

// Drives the `--fix` workflow: builds an upgrade plan for vulnerable
// direct dependencies, renders a dry-run preview, prompts for confirmation
// (or honours `--yes` in CI), then runs the package manager add command
// per workspace. Returns an exit code when the loop short-circuits, or
// undefined to continue with the post-fix rescan.
const runApplyDirect = async (arguments_: RunApplyDirectArguments): Promise<number | undefined> => {
    const plan: DirectApplyPlan = buildDirectApplyPlan({
        allowMajor: arguments_.allowMajor,
        findings: arguments_.actionableFindings,
        workspaceRoot: arguments_.workspaceRoot,
    });

    pail.info("");
    pail.info("─ Apply (direct deps)");
    pail.info(formatDirectApplyPlan(plan));

    if (plan.apply.length === 0) {
        pail.info("Nothing to apply for direct deps.");

        return undefined;
    }

    if (isInCi && !arguments_.yes) {
        pail.error("Refusing to run --fix in CI without --yes. Re-run with --yes once the plan above looks right.");

        return 1;
    }

    if (!arguments_.yes) {
        const ok = await promptYesNo("Apply these direct-dep upgrades?", false);

        if (!ok) {
            pail.info("Aborted — no changes made.");

            return 0;
        }
    }

    // Group fixes by workspace name so we can dispatch one update per workspace.
    const byWorkspace = new Map<string, typeof plan.apply>();

    for (const fix of plan.apply) {
        const key = fix.workspaceName ?? "";
        const list = byWorkspace.get(key);

        if (list) {
            list.push(fix);
        } else {
            byWorkspace.set(key, [fix]);
        }
    }

    for (const [workspaceName, fixes] of byWorkspace) {
        const packages = fixes.map((f) => `${f.packageName}@${f.targetSpec}`);
        const filter = workspaceName.length > 0 ? [workspaceName] : [];

        pail.info(`Running ${arguments_.pm.name} add ${packages.join(" ")}${workspaceName.length > 0 ? ` --filter ${workspaceName}` : ""}`);

        const exit = runAdd(
            arguments_.pm,
            {
                exact: false,
                filter,
                global: false,
                optional: false,
                packages,
                peer: false,
                saveDev: false,
                workspace: false,
                workspaceRoot: false,
            },
            arguments_.workspaceRoot,
            console,
        );

        if (exit !== 0) {
            pail.error(`${arguments_.pm.name} add exited ${String(exit)} — aborting before rescan.`);

            return exit;
        }
    }

    pail.success("Direct-dep upgrades applied. Re-run `vis audit` to confirm the fixes landed.");

    return 0;
};

interface RunApplyTransitiveArguments {
    actionableFindings: ActionableFinding[];
    pm: ApplyPmInfo;
    visConfig: VisConfig | undefined;
    workspaceRoot: string;
    yes: boolean;
}

// Drives the `--fix-transitive` workflow: builds an override plan for the
// vulnerable transitives, enforces the CI two-lock gate (`--yes` plus
// `security.audit.apply.transitive.enabled`), renders the dry-run preview,
// prompts the user, then writes the PM-specific override surface. Returns
// an exit code when the loop short-circuits, or undefined to continue.
const runApplyTransitive = async (arguments_: RunApplyTransitiveArguments): Promise<number | undefined> => {
    if (!isTransitiveOnlyPm(arguments_.pm.name)) {
        pail.error(`--fix-transitive is not supported for package manager "${arguments_.pm.name}". Use pnpm, npm, yarn, or bun.`);

        return 1;
    }

    const transitiveEnabled = Boolean(arguments_.visConfig?.security?.audit?.apply?.transitive?.enabled);

    if (isInCi && (!arguments_.yes || !transitiveEnabled)) {
        pail.error(
            "Refusing to run --fix-transitive in CI without both --yes and security.audit.apply.transitive.enabled = true. "
            + "Overrides have a higher blast radius than direct bumps — gate on config.",
        );

        return 1;
    }

    // Only plan overrides for findings whose package isn't a direct dep.
    const directlyDeclared = new Set(
        buildDirectApplyPlan({
            findings: arguments_.actionableFindings,
            workspaceRoot: arguments_.workspaceRoot,
        }).apply.map((f) => f.packageName),
    );

    const transitiveFindings = arguments_.actionableFindings.filter((f) => !directlyDeclared.has(f.packageName));
    const plan = buildOverridePlanFromFindings(transitiveFindings);

    if (plan.entries.length === 0) {
        pail.info("");
        pail.info("─ Apply transitive (overrides)");
        pail.info("Nothing to override — all vulnerable packages are direct deps or have no fixed version.");

        return undefined;
    }

    const planResult = planOverrideWrite(arguments_.workspaceRoot, plan, { name: arguments_.pm.name, version: arguments_.pm.version });

    pail.info("");
    pail.info("─ Apply transitive (overrides)");
    pail.info(`Target: ${planResult.filePath} (${planResult.surface})`);

    for (const entry of planResult.entries) {
        const tag = entry.status === "added" ? "+" : entry.status === "updated" ? "~" : "·";

        const previous = entry.previousSpec ? ` (was ${entry.previousSpec})` : "";

        pail.info(`  ${tag} ${entry.packageName}: ${entry.spec}${previous}`);
    }

    if (!planResult.changed) {
        pail.info("No changes — overrides already match the plan.");

        return undefined;
    }

    if (!arguments_.yes) {
        if (isInCi) {
            // Already gated above, but double-belt.
            return 1;
        }

        const ok = await promptYesNo("Write these overrides?", false);

        if (!ok) {
            pail.info("Aborted — no changes made.");

            return 0;
        }
    }

    try {
        applyOverridePlan(planResult);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        pail.error(`Failed to write overrides: ${message}`);

        return 1;
    }

    pail.success(
        `Wrote ${String(planResult.entries.filter((e) => e.status !== "unchanged").length)} override${
            planResult.entries.length === 1 ? "" : "s"
        }. Run \`${arguments_.pm.name} install\` then re-run \`vis audit\` to confirm the fixes landed.`,
    );

    return 0;
};

const execute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, AuditOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    await executeAudit(wsRoot, options, visConfig, logger);
};

export default execute as CommandExecute<Toolbox>;
