/**
 * Canonical audit-report builder. Same object backs `vis audit --format json`
 * and the structured payload the HTML report embeds — so any future consumer
 * (CI plugin, dashboard, etc.) can read either surface and get an identical
 * shape.
 *
 * Keep this module side-effect-free and dependency-free at runtime so it can
 * be imported from the HTML emitter (which is bundled inline) without
 * pulling in the wider security pipeline.
 */

import { explainKey } from "../../ai/audit-explain";
import type { SecurityVulnerability } from "../../security/advisories";
import type { DependencyPath } from "../../security/dependency-paths";
import type { DuplicatePackage } from "../../security/dependency-scan";
import type { PolicyDecision } from "../../security/policies";
import type { AcceptedRisk, PackageAlert, PackageReportData } from "../../security/socket-security";

export interface AuditReportEntryVulnerability extends SecurityVulnerability {
    /** Optional `--explain` text stitched in by the handler. */
    explanation?: string;
}

export interface AuditReportEntry {
    acceptedRisk: AcceptedRisk | null;

    /**
     * Root → vulnerable resolution paths through the lockfile graph.
     * Up to `BuildAuditReportInput.maxDependencyPathsPerEntry` are listed,
     * shortest first. Empty when the path-walker had no graph to query
     * (lockfile missing or workspace roots unresolved).
     */
    dependencyPaths: DependencyPath[];
    name: string;
    socketAlerts: PackageAlert[];
    socketScore: number | null;
    version: string;
    vulnerabilities: AuditReportEntryVulnerability[];
}

export interface AuditReportDuplicate {
    name: string;
    versionCount: number;
    versions: string[];
}

export interface AuditReportPolicy {
    acceptedRisk: AcceptedRisk | null;
    data: Record<string, unknown> | null;
    packageName: string;
    policy: string;
    reason: string;
    severity: PolicyDecision["severity"];
    version: string;
}

export interface AuditReportSummary {
    accepted: number;
    duplicatePackages: number;
    issues: number;
    policyBlocks: number;
    policyDecisions: number;
    total: number;
}

export interface AuditReportWarning {
    kind: "unknown-policy";
    token: string;
}

export interface AuditReportTool {
    informationUri?: string;
    name: string;
    version: string;
}

/**
 * Schema versioning lets downstream consumers detect breaking changes.
 * Bump the minor when adding fields, the major when removing/renaming
 * existing ones.
 */
export const AUDIT_REPORT_SCHEMA_VERSION = "1.0" as const;

export interface AuditReportBloomHit {
    name: string;
    version: string;
}

export interface AuditReport {
    bloomHits: AuditReportBloomHit[];
    duplicates: AuditReportDuplicate[];
    /** ISO timestamp when the report was generated. */
    generatedAt: string;
    /** Number of installed packages scanned. */
    packages: number;
    policies: AuditReportPolicy[];
    results: AuditReportEntry[];
    schemaVersion: typeof AUDIT_REPORT_SCHEMA_VERSION;
    summary: AuditReportSummary;
    tool: AuditReportTool;
    warnings: AuditReportWarning[];
    workspaceRoot: string;
}

export interface BuildAuditReportInput {
    /** OSV bloom-filter hits — flagged packages awaiting confirmation. */
    bloomHits: ReadonlyArray<AuditReportBloomHit>;
    /** Duplicate-version detections from `findDuplicateDependencies`. */
    duplicates: DuplicatePackage[];

    /**
     * AI explanations keyed by {@link explainKey} — both the JSON path and
     * the HTML embed pull from this map so the same explanation text is
     * surfaced everywhere.
     */
    explanations: ReadonlyMap<string, string>;
    /** Severity-filtered audit entries with vulns + Socket reports. */
    filtered: ReadonlyArray<{
        acceptedRisk?: AcceptedRisk;

        /**
         * Pre-computed root→vuln paths from the lockfile graph. Empty array
         * (or absent) when paths weren't computed for this entry.
         */
        dependencyPaths?: ReadonlyArray<DependencyPath>;
        name: string;
        socketReport?: PackageReportData;
        version: string;
        vulnerabilities: ReadonlyArray<SecurityVulnerability>;
    }>;
    /** Override the generation timestamp (tests pass a fixed date). */
    now?: Date;
    /** Total number of installed packages scanned (pre-filter). */
    packagesScanned: number;
    /** Non-vulnerability policy decisions. */
    policyDecisions: ReadonlyArray<PolicyDecision>;
    /** Tool identification for the report header. */
    tool: AuditReportTool;
    /** Unknown `--policies` tokens — surfaced as warnings. */
    unknownPolicyTokens: ReadonlyArray<string>;
    /** Absolute workspace root, mirrored verbatim into the report. */
    workspaceRoot: string;
}

export const buildAuditReport = (input: BuildAuditReportInput): AuditReport => {
    const { bloomHits, duplicates, explanations, filtered, now, packagesScanned, policyDecisions, tool, unknownPolicyTokens, workspaceRoot } = input;

    const results: AuditReportEntry[] = filtered.map((entry) => {
        return {
            acceptedRisk: entry.acceptedRisk ?? null,
            dependencyPaths: entry.dependencyPaths ? entry.dependencyPaths.map((path) => path.map((node) => { return { name: node.name, version: node.version }; })) : [],
            name: entry.name,
            socketAlerts: entry.socketReport?.alerts ?? [],
            socketScore: entry.socketReport?.score.overall ?? null,
            version: entry.version,
            vulnerabilities: entry.vulnerabilities.map((vulnerability) => {
                const explanation = explanations.get(explainKey({ packageName: entry.name, packageVersion: entry.version, vulnerability }));

                return explanation ? { ...vulnerability, explanation } : { ...vulnerability };
            }),
        };
    });

    const policies: AuditReportPolicy[] = policyDecisions.map((decision) => {
        return {
            acceptedRisk: decision.acceptedRisk ?? null,
            data: decision.data ?? null,
            packageName: decision.packageName,
            policy: decision.policy,
            reason: decision.reason,
            severity: decision.severity,
            version: decision.version,
        };
    });

    const summary: AuditReportSummary = {
        accepted: results.filter((e) => e.acceptedRisk !== null).length,
        duplicatePackages: duplicates.length,
        issues: results.filter((e) => e.acceptedRisk === null).length,
        policyBlocks: policies.filter((d) => d.severity === "block" && d.acceptedRisk === null).length,
        policyDecisions: policies.length,
        total: results.length,
    };

    const warnings: AuditReportWarning[] = unknownPolicyTokens.map((token) => {
        return { kind: "unknown-policy", token };
    });

    return {
        bloomHits: bloomHits.map((hit) => {
            return { name: hit.name, version: hit.version };
        }),
        duplicates: duplicates.map((d) => {
            return {
                name: d.name,
                versionCount: d.versions.length,
                versions: [...d.versions],
            };
        }),
        generatedAt: (now ?? new Date()).toISOString(),
        packages: packagesScanned,
        policies,
        results,
        schemaVersion: AUDIT_REPORT_SCHEMA_VERSION,
        summary,
        tool,
        warnings,
        workspaceRoot,
    };
};
