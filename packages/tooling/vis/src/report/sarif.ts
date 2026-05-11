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

export interface SarifFinding {
    packageName: string;
    packageVersion: string;
    vulnerability: SecurityVulnerability;
    acknowledged: boolean;
}

export interface SarifEmitOptions {
    workspaceRoot: string;
    tool: { name: string; version: string; informationUri: string };
    findings: SarifFinding[];
    /** Optional explicit lockfile path. Defaults to "package.json" relative to the workspace root. */
    artifactUri?: string;
}

const SEVERITY_TO_LEVEL: Record<string, "error" | "warning" | "note" | "none"> = {
    CRITICAL: "error",
    HIGH: "error",
    MODERATE: "warning",
    LOW: "note",
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
    MODERATE: "5.5",
    LOW: "2.5",
    UNKNOWN: "0.0",
};

const SEVERITY_TO_LABEL: Record<string, string> = {
    CRITICAL: "critical",
    HIGH: "high",
    MODERATE: "medium",
    LOW: "low",
    UNKNOWN: "none",
};

export interface SarifLog {
    $schema: string;
    version: "2.1.0";
    runs: SarifRun[];
}

interface SarifRun {
    tool: {
        driver: {
            name: string;
            semanticVersion?: string;
            version: string;
            informationUri: string;
            rules: SarifRule[];
        };
    };
    results: SarifResult[];
}

interface SarifRule {
    id: string;
    name: string;
    shortDescription: { text: string };
    fullDescription: { text: string };
    helpUri?: string;
    defaultConfiguration: { level: "error" | "warning" | "note" | "none" };
    properties: {
        "security-severity": string;
        "severity-label": string;
        tags: string[];
        precision?: "very-high" | "high" | "medium" | "low";
    };
}

interface SarifResult {
    ruleId: string;
    level: "error" | "warning" | "note" | "none";
    message: { text: string };
    locations: {
        physicalLocation: {
            artifactLocation: { uri: string };
        };
        logicalLocations?: { name: string; kind: string }[];
    }[];
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

export const emitSarif = (options: SarifEmitOptions): SarifLog => {
    const rulesById = new Map<string, SarifRule>();
    const results: SarifResult[] = [];
    const lockfileUri = options.artifactUri ?? (relative(options.workspaceRoot, join(options.workspaceRoot, "package.json")) || "package.json");

    for (const finding of options.findings) {
        const { vulnerability: vuln, packageName, packageVersion, acknowledged } = finding;
        const level = SEVERITY_TO_LEVEL[vuln.severity] ?? "none";
        const label = SEVERITY_TO_LABEL[vuln.severity] ?? "none";

        if (!rulesById.has(vuln.id)) {
            rulesById.set(vuln.id, {
                id: vuln.id,
                name: vuln.id,
                shortDescription: { text: (vuln.summary.split("\n")[0] ?? vuln.id).slice(0, 200) },
                fullDescription: { text: vuln.summary || `Advisory ${vuln.id}` },
                helpUri: advisoryUri(vuln.id),
                defaultConfiguration: { level },
                properties: {
                    "security-severity": securitySeverity(vuln),
                    "severity-label": label,
                    tags: ["security", "vulnerability", "supply-chain", `severity:${label}`],
                    precision: "very-high",
                },
            });
        }

        results.push({
            ruleId: vuln.id,
            level,
            message: {
                text: `${vuln.id}: ${packageName}@${packageVersion} — ${vuln.summary || "no summary"}${
                    vuln.fixedVersions.length > 0 ? ` (fix: ${vuln.fixedVersions.join(", ")})` : ""
                }`,
            },
            locations: [
                {
                    physicalLocation: {
                        artifactLocation: { uri: lockfileUri },
                    },
                    logicalLocations: [
                        { name: `${packageName}@${packageVersion}`, kind: "package" },
                    ],
                },
            ],
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
        });
    }

    return {
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        version: "2.1.0",
        runs: [
            {
                tool: {
                    driver: {
                        name: options.tool.name,
                        version: options.tool.version,
                        informationUri: options.tool.informationUri,
                        rules: [...rulesById.values()],
                    },
                },
                results,
            },
        ],
    };
};
