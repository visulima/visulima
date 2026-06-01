/**
 * Shared finding-shape helpers used by every audit report format
 * (SARIF, CSAF, CycloneDX-VEX, HTML, the table renderer, the JSON path).
 *
 * Centralising these prevents the four emitters from drifting: when GitHub
 * adds a new severity bucket, only one constant table changes; when osv.dev
 * moves the canonical advisory URL, only one builder updates.
 *
 * Keep this module side-effect-free and dependency-free at runtime — the
 * HTML emitter is bundled inline and imports this directly.
 */

import type { SecurityVulnerability } from "../security/advisories";

/**
 * Canonical severity vocabulary. `MODERATE` follows OSV's naming; emitters
 * that report `medium` (CycloneDX, CSAF, SARIF's severity-label) map it via
 * {@link severityLabel}.
 */
export type Severity = SecurityVulnerability["severity"];

export const SEVERITY_ORDER: ReadonlyArray<Severity> = ["CRITICAL", "HIGH", "MODERATE", "LOW", "UNKNOWN"];

/** SARIF result `level` per GitHub Code Scanning convention. */
export type SarifLevel = "error" | "note" | "warning" | "none";

const SEVERITY_TO_SARIF_LEVEL: Record<Severity, SarifLevel> = {
    CRITICAL: "error",
    HIGH: "error",
    LOW: "note",
    MODERATE: "warning",
    UNKNOWN: "none",
};

/** Lowercase severity label used by CSAF / CycloneDX-VEX / SARIF `severity-label`. */
const SEVERITY_TO_LABEL: Record<Severity, string> = {
    CRITICAL: "critical",
    HIGH: "high",
    LOW: "low",
    MODERATE: "medium",
    UNKNOWN: "none",
};

/**
 * CVSS-band fallback scores — used when an advisory has no `cvssScore`.
 * Numbers match the upper end of each canonical severity band on CVSS v3.
 */
const SEVERITY_TO_FALLBACK_SCORE: Record<Severity, number> = {
    CRITICAL: 9.5,
    HIGH: 8,
    LOW: 2.5,
    MODERATE: 5.5,
    UNKNOWN: 0,
};

export const severityToSarifLevel = (severity: Severity): SarifLevel => SEVERITY_TO_SARIF_LEVEL[severity];

export const severityLabel = (severity: Severity): string => SEVERITY_TO_LABEL[severity];

export const severityFallbackScore = (severity: Severity): number => SEVERITY_TO_FALLBACK_SCORE[severity];

/**
 * Resolve a numeric CVSS base score from a vulnerability. Returns the
 * advisory's `cvssScore` when it's a finite number, otherwise falls back
 * to the band midpoint via {@link severityFallbackScore}.
 */
export const cvssScore = (vulnerability: Pick<SecurityVulnerability, "cvssScore" | "severity">): number => {
    if (typeof vulnerability.cvssScore === "number" && Number.isFinite(vulnerability.cvssScore)) {
        return vulnerability.cvssScore;
    }

    return severityFallbackScore(vulnerability.severity);
};

/** CVSS score formatted to one decimal — SARIF's `security-severity` shape. */
export const securitySeverityString = (vulnerability: Pick<SecurityVulnerability, "cvssScore" | "severity">): string => cvssScore(vulnerability).toFixed(1);

/**
 * Canonical advisory landing page for an OSV/CVE/GHSA id.
 * - CVE-…  → NVD
 * - GHSA-… → GitHub Advisory Database
 * - else   → osv.dev.
 */
export const advisoryUri = (id: string): string => {
    if (id.startsWith("CVE-")) {
        return `https://nvd.nist.gov/vuln/detail/${id}`;
    }

    if (id.startsWith("GHSA-")) {
        return `https://github.com/advisories/${id}`;
    }

    return `https://osv.dev/vulnerability/${id}`;
};

/** Human-readable name of the advisory source an id belongs to. */
export const advisorySourceName = (id: string): string => {
    if (id.startsWith("CVE-")) {
        return "NVD";
    }

    if (id.startsWith("GHSA-")) {
        return "GitHub Advisory Database";
    }

    return "OSV";
};
