/**
 * SARIF 2.1.0 emitter for `vis audit`.
 *
 * One `run` per audit invocation. `tool.driver.name = "vis-audit"`, rules
 * keyed by advisory id (CVE / GHSA / OSV), one `result` per (package, advisory)
 * pair. `level` follows the GitHub Code Scanning convention: CRITICAL/HIGH →
 * `error`, MODERATE → `warning`, LOW → `note`. `properties.security-severity`
 * carries the CVSS base score when known so the scanner UI shows a CVSS-based
 * severity label (`medium` for our internal `MODERATE`).
 *
 * `partialFingerprints` lets GitHub Code Scanning deduplicate across runs even
 * when the lockfile path or the package version changes — the fingerprint is
 * (advisoryId, package, version), so re-running after a bump cleanly closes
 * the prior alert and opens a new one if a different version is still
 * affected.
 */

import { join, relative } from "node:path";

import type { SecurityVulnerability } from "../security/advisories";
import type { PolicyDecision } from "../security/policies";

export interface SarifFinding {
    acknowledged: boolean;
    packageName: string;
    packageVersion: string;
    vulnerability: SecurityVulnerability;
}

export interface SarifEmitOptions {
    /** Optional explicit lockfile path. Defaults to "package.json" relative to the workspace root. */
    artifactUri?: string;
    findings: SarifFinding[];

    /**
     * Non-vulnerability policy decisions (license / install_scripts /
     * unexpected_deps / …). Vulnerability decisions are emitted via
     * `findings` above so they get full advisory metadata.
     */
    policyDecisions?: PolicyDecision[];
    tool: { informationUri: string; name: string; version: string };
    workspaceRoot: string;
}

type SarifLevel = "error" | "warning" | "note" | "none";

const SEVERITY_TO_LEVEL: Record<string, SarifLevel> = {
    CRITICAL: "error",
    HIGH: "error",
    LOW: "note",
    MODERATE: "warning",
    UNKNOWN: "none",
};

/**
 * CVSS-base-score buckets used when an advisory has no CVSS score attached.
 * Numbers match the upper end of each canonical severity band on the CVSS v3
 * scale so SARIF consumers' "severity from score" labels stay accurate.
 */
const SEVERITY_TO_SECURITY_SEVERITY: Record<string, string> = {
    CRITICAL: "9.5",
    HIGH: "8.0",
    LOW: "2.5",
    MODERATE: "5.5",
    UNKNOWN: "0.0",
};

const SEVERITY_TO_LABEL: Record<string, string> = {
    CRITICAL: "critical",
    HIGH: "high",
    LOW: "low",
    MODERATE: "medium",
    UNKNOWN: "none",
};

export interface SarifLog {
    $schema: string;
    runs: SarifRun[];
    version: "2.1.0";
}

interface SarifRun {
    results: SarifResult[];
    tool: {
        driver: {
            informationUri: string;
            name: string;
            rules: SarifRule[];
            semanticVersion?: string;
            version: string;
        };
    };
}

interface SarifRule {
    defaultConfiguration: { level: SarifLevel };
    fullDescription: { text: string };
    helpUri?: string;
    id: string;
    name: string;
    properties: {
        precision?: "very-high" | "high" | "medium" | "low";
        "security-severity": string;
        "severity-label": string;
        tags: string[];
    };
    shortDescription: { text: string };
}

interface SarifResult {
    level: SarifLevel;
    locations: {
        logicalLocations?: { kind: string; name: string }[];
        physicalLocation: {
            artifactLocation: { uri: string };
        };
    }[];
    message: { text: string };
    partialFingerprints: Record<string, string>;
    properties?: {
        acknowledged?: boolean;
        aliases?: string[];
        cvssScore?: number;
        fixedVersions?: string[];
        packageName?: string;
        packageVersion?: string;
        severityLabel?: string;
    };
    ruleId: string;
}

const advisoryUri = (id: string): string => {
    if (id.startsWith("CVE-")) {
        return `https://nvd.nist.gov/vuln/detail/${id}`;
    }

    if (id.startsWith("GHSA-")) {
        return `https://github.com/advisories/${id}`;
    }

    return `https://osv.dev/vulnerability/${id}`;
};

const securitySeverity = (vuln: SecurityVulnerability): string => {
    if (typeof vuln.cvssScore === "number" && Number.isFinite(vuln.cvssScore)) {
        return vuln.cvssScore.toFixed(1);
    }

    return SEVERITY_TO_SECURITY_SEVERITY[vuln.severity] ?? "0.0";
};

/** Builds a SARIF 2.1.0 log from OSV findings plus non-vulnerability policy decisions (one rule per advisory id and per policy name). */
export const emitSarif = (options: SarifEmitOptions): SarifLog => {
    const rulesById = new Map<string, SarifRule>();
    const results: SarifResult[] = [];
    const lockfileUri = options.artifactUri ?? (relative(options.workspaceRoot, join(options.workspaceRoot, "package.json")) || "package.json");

    for (const finding of options.findings) {
        const { acknowledged, packageName, packageVersion, vulnerability: vuln } = finding;
        const level = SEVERITY_TO_LEVEL[vuln.severity] ?? "none";
        const label = SEVERITY_TO_LABEL[vuln.severity] ?? "none";

        if (!rulesById.has(vuln.id)) {
            rulesById.set(vuln.id, {
                defaultConfiguration: { level },
                fullDescription: { text: vuln.summary || `Advisory ${vuln.id}` },
                helpUri: advisoryUri(vuln.id),
                id: vuln.id,
                name: vuln.id,
                properties: {
                    precision: "very-high",
                    "security-severity": securitySeverity(vuln),
                    "severity-label": label,
                    tags: ["security", "vulnerability", "supply-chain", `severity:${label}`],
                },
                shortDescription: { text: (vuln.summary.split("\n")[0] ?? vuln.id).slice(0, 200) },
            });
        }

        results.push({
            level,
            locations: [
                {
                    logicalLocations: [{ kind: "package", name: `${packageName}@${packageVersion}` }],
                    physicalLocation: {
                        artifactLocation: { uri: lockfileUri },
                    },
                },
            ],
            message: {
                text: `${vuln.id}: ${packageName}@${packageVersion} — ${vuln.summary || "no summary"}${
                    vuln.fixedVersions.length > 0 ? ` (fix: ${vuln.fixedVersions.join(", ")})` : ""
                }`,
            },
            partialFingerprints: {
                advisoryId: vuln.id,
                package: packageName,
                version: packageVersion,
            },
            properties: {
                ...(acknowledged ? { acknowledged: true } : {}),
                ...(vuln.aliases && vuln.aliases.length > 0 ? { aliases: vuln.aliases } : {}),
                ...(typeof vuln.cvssScore === "number" ? { cvssScore: vuln.cvssScore } : {}),
                ...(vuln.fixedVersions.length > 0 ? { fixedVersions: vuln.fixedVersions } : {}),
                packageName,
                packageVersion,
                severityLabel: label,
            },
            ruleId: vuln.id,
        });
    }

    // Non-vulnerability policy decisions ride alongside advisories. One
    // SARIF rule per policy name keeps the rule table small while still
    // letting Code Scanning render the right severity badge per row.
    const policyLevel: Record<PolicyDecision["severity"], SarifLevel> = {
        block: "error",
        info: "note",
        warn: "warning",
    };
    const policyLabel: Record<PolicyDecision["severity"], string> = {
        block: "high",
        info: "none",
        warn: "medium",
    };

    for (const decision of options.policyDecisions ?? []) {
        if (decision.policy === "vulnerability") {
            // Already covered by the OSV pass above.
            continue;
        }

        const ruleId = `vis.policy.${decision.policy}`;
        const level = policyLevel[decision.severity];
        const label = policyLabel[decision.severity];

        if (!rulesById.has(ruleId)) {
            rulesById.set(ruleId, {
                defaultConfiguration: { level },
                fullDescription: { text: `vis policy '${decision.policy}' (Socket.dev-style supply-chain gate)` },
                helpUri: `https://visulima.com/packages/vis/commands/audit#policy-${decision.policy}`,
                id: ruleId,
                name: ruleId,
                properties: {
                    precision: "high",
                    "security-severity": decision.severity === "block" ? "8.0" : decision.severity === "warn" ? "5.5" : "0.0",
                    "severity-label": label,
                    tags: ["security", "supply-chain", "policy", `policy:${decision.policy}`],
                },
                shortDescription: { text: `vis policy: ${decision.policy}` },
            });
        }

        results.push({
            level,
            locations: [
                {
                    logicalLocations: [{ kind: "package", name: `${decision.packageName}@${decision.version}` }],
                    physicalLocation: { artifactLocation: { uri: lockfileUri } },
                },
            ],
            message: { text: decision.reason },
            partialFingerprints: {
                package: decision.packageName,
                policy: decision.policy,
                version: decision.version,
            },
            properties: {
                ...(decision.acceptedRisk ? { acknowledged: true } : {}),
                packageName: decision.packageName,
                packageVersion: decision.version,
                severityLabel: label,
            },
            ruleId,
        });
    }

    return {
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        runs: [
            {
                results,
                tool: {
                    driver: {
                        informationUri: options.tool.informationUri,
                        name: options.tool.name,
                        rules: [...rulesById.values()],
                        version: options.tool.version,
                    },
                },
            },
        ],
        version: "2.1.0",
    };
};
