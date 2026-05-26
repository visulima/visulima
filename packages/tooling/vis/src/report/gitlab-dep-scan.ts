/**
 * GitLab dependency-scanning report emitter.
 *
 * Targets the `dependency_scanning` schema at v15.2.1 — the version
 * GitLab CI's Secure stage ingests today
 * (https://gitlab.com/gitlab-org/security-products/security-report-schemas).
 *
 * One `vulnerabilities[]` entry per (package, advisory) pair. UUIDs are
 * deterministic (UUIDv5, derived from the advisory id + name@version)
 * so re-runs produce the same `id` and GitLab can dedupe across
 * pipelines.
 */

import { createHash } from "node:crypto";
import { relative } from "node:path";

import type { SecurityVulnerability } from "../security/advisories";
import type { PolicyDecision } from "../security/policies";
import { advisorySourceName, advisoryUri } from "./finding";

export interface GitlabDepScanFinding {
    acknowledged: boolean;
    packageName: string;
    packageVersion: string;
    vulnerability: SecurityVulnerability;
}

export interface GitlabDepScanEmitOptions {
    /** Lockfile path reported in `location.file`. Defaults to `package.json`. */
    artifactUri?: string;
    findings: GitlabDepScanFinding[];
    /** Override the scan timestamps. Tests pass a fixed Date. */
    now?: Date;
    /** Non-vuln policy decisions are also surfaced as vulnerabilities[] rows. */
    policyDecisions?: PolicyDecision[];
    tool: { informationUri: string; name: string; version: string };
    workspaceRoot: string;
}

interface GitlabIdentifier {
    name: string;
    type: string;
    url?: string;
    value: string;
}

interface GitlabLink {
    name?: string;
    url: string;
}

interface GitlabVulnerability {
    cvss_vectors?: { vector: string; vendor: string }[];
    description: string;
    details?: Record<string, unknown>;
    flags?: { description: string; origin: string; type: "flagged-as-likely-false-positive" }[];
    id: string;
    identifiers: GitlabIdentifier[];
    links?: GitlabLink[];
    location: {
        dependency: {
            direct?: boolean;
            package: { name: string };
            version: string;
        };
        file: string;
    };
    name: string;
    severity: "Critical" | "High" | "Info" | "Low" | "Medium" | "Unknown";
    solution?: string;
}

export interface GitlabDepScanReport {
    scan: {
        analyzer: { id: string; name: string; url: string; vendor: { name: string }; version: string };
        end_time: string;
        scanner: { id: string; name: string; url: string; vendor: { name: string }; version: string };
        start_time: string;
        status: "failure" | "success";
        type: "dependency_scanning";
    };
    schema: string;
    version: string;
    vulnerabilities: GitlabVulnerability[];
}

/** GitLab Secure report schema version. Pinned — bump deliberately. */
const SCHEMA_VERSION = "15.2.1";
const SCHEMA_URL = `https://gitlab.com/gitlab-org/security-products/security-report-schemas/-/raw/v${SCHEMA_VERSION}/dist/dependency-scanning-report-format.json`;

/**
 * Severity table — GitLab uses Title-Case strings and tops out at "Critical".
 * `Info` is reserved for advisory-only policy decisions.
 */
const SEVERITY_TO_GITLAB: Record<SecurityVulnerability["severity"], GitlabVulnerability["severity"]> = {
    CRITICAL: "Critical",
    HIGH: "High",
    LOW: "Low",
    MODERATE: "Medium",
    UNKNOWN: "Unknown",
};

const POLICY_SEVERITY_TO_GITLAB: Record<PolicyDecision["severity"], GitlabVulnerability["severity"]> = {
    block: "High",
    info: "Info",
    warn: "Medium",
};

/**
 * Stable v5 UUID derivation. Uses the OID namespace (RFC 4122 §C) since
 * GitLab itself doesn't reserve one for finding IDs — what matters is
 * that the same inputs always produce the same UUID so re-runs dedupe.
 */
const NAMESPACE_OID_BYTES = Uint8Array.from([0x6b, 0xa7, 0xb8, 0x12, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8]);

const uuidV5 = (name: string): string => {
    const hash = createHash("sha1");

    hash.update(NAMESPACE_OID_BYTES);
    hash.update(name, "utf8");

    const bytes = hash.digest();

    // Version 5 marker in the high nibble of byte 6.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
    // RFC 4122 variant (10xx) in the high two bits of byte 8.
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

    const hex = bytes.subarray(0, 16).toString("hex");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const identifierFromAdvisoryId = (advisoryId: string): GitlabIdentifier => {
    if (advisoryId.startsWith("CVE-")) {
        return { name: advisoryId, type: "cve", url: advisoryUri(advisoryId), value: advisoryId };
    }

    if (advisoryId.startsWith("GHSA-")) {
        return { name: advisoryId, type: "ghsa", url: advisoryUri(advisoryId), value: advisoryId };
    }

    return { name: advisoryId, type: "osv", url: advisoryUri(advisoryId), value: advisoryId };
};

/**
 * Builds the GitLab dependency-scanning report. Empty `findings` is a
 * valid emission — GitLab accepts a `vulnerabilities: []` document.
 */
export const emitGitlabDepScan = (options: GitlabDepScanEmitOptions): GitlabDepScanReport => {
    const now = options.now ?? new Date();
    // Schema (v15.2.1) pins `scan.start_time` / `end_time` to the
    // pattern `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$` — no milliseconds,
    // no trailing `Z`. Strip both off `toISOString()`.
    const timestamp = now.toISOString().replace(/\.\d{3}Z$/, "");
    const lockfilePath = options.artifactUri ?? (relative(options.workspaceRoot, `${options.workspaceRoot}/package.json`) || "package.json");

    const vulnerabilities: GitlabVulnerability[] = [];

    for (const finding of options.findings) {
        const { acknowledged, packageName, packageVersion, vulnerability: vuln } = finding;
        const identifiers: GitlabIdentifier[] = [identifierFromAdvisoryId(vuln.id)];

        for (const alias of vuln.aliases ?? []) {
            if (alias !== vuln.id) {
                identifiers.push(identifierFromAdvisoryId(alias));
            }
        }

        const links: GitlabLink[] = [{ name: `${advisorySourceName(vuln.id)} advisory`, url: advisoryUri(vuln.id) }];

        const description = vuln.summary || `Advisory ${vuln.id}`;
        const solution = vuln.fixedVersions.length > 0 ? `Upgrade ${packageName} to ${vuln.fixedVersions.join(" or ")}` : undefined;

        vulnerabilities.push({
            description,
            ...(acknowledged ? { flags: [{ description: "Acknowledged via vis accepted-risks", origin: "vis", type: "flagged-as-likely-false-positive" as const }] } : {}),
            id: uuidV5(`vis-audit|${vuln.id}|${packageName}@${packageVersion}`),
            identifiers,
            links,
            location: {
                dependency: { package: { name: packageName }, version: packageVersion },
                file: lockfilePath,
            },
            name: `${vuln.id}: ${packageName}@${packageVersion}`,
            severity: SEVERITY_TO_GITLAB[vuln.severity],
            ...(solution ? { solution } : {}),
        });
    }

    for (const decision of options.policyDecisions ?? []) {
        if (decision.policy === "vulnerability") {
            continue;
        }

        const policyId = `vis.policy.${decision.policy}`;

        vulnerabilities.push({
            description: decision.reason,
            ...(decision.acceptedRisk ? { flags: [{ description: "Acknowledged via vis accepted-risks", origin: "vis", type: "flagged-as-likely-false-positive" as const }] } : {}),
            id: uuidV5(`vis-audit|${policyId}|${decision.packageName}@${decision.version}`),
            identifiers: [{ name: policyId, type: "vis_policy", url: `https://visulima.com/packages/vis/commands/audit#policy-${decision.policy}`, value: policyId }],
            links: [{ name: `vis policy: ${decision.policy}`, url: `https://visulima.com/packages/vis/commands/audit#policy-${decision.policy}` }],
            location: {
                dependency: { package: { name: decision.packageName }, version: decision.version },
                file: lockfilePath,
            },
            name: `vis policy '${decision.policy}': ${decision.packageName}@${decision.version}`,
            severity: POLICY_SEVERITY_TO_GITLAB[decision.severity],
        });
    }

    return {
        scan: {
            analyzer: { id: options.tool.name, name: options.tool.name, url: options.tool.informationUri, vendor: { name: "Visulima" }, version: options.tool.version },
            end_time: timestamp,
            scanner: { id: options.tool.name, name: options.tool.name, url: options.tool.informationUri, vendor: { name: "Visulima" }, version: options.tool.version },
            start_time: timestamp,
            status: "success",
            type: "dependency_scanning",
        },
        schema: SCHEMA_URL,
        version: SCHEMA_VERSION,
        vulnerabilities,
    };
};

