/**
 * Shared severity helpers used by the audit handler and the vulnerability
 * policy module. Both surfaces compare an OSV/Socket finding's severity
 * against a user-configured threshold (`--severity`, `failOn`); keeping
 * the table in one place avoids drift.
 */

export type SeverityFilter = "critical" | "high" | "low" | "medium";

const MODERATE_LEVEL = 2;
const UNKNOWN_LEVEL = 4;

/** Lower number = more severe. Used for `level >= threshold` comparisons. */
export const SEVERITY_ORDER: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    LOW: 3,
    MODERATE: MODERATE_LEVEL,
    UNKNOWN: UNKNOWN_LEVEL,
};

/**
 * Canonical display order shared by every surface that lists findings
 * (terminal table, HTML report, and the numeric `--explain` index): most
 * severe first, then package name, then version. Keeping one comparator
 * guarantees `--explain 2` points at the finding the user sees as row 2.
 */
export const compareFindingsForDisplay = (
    a: { packageName: string; packageVersion: string; vulnerability: { severity?: string } },
    b: { packageName: string; packageVersion: string; vulnerability: { severity?: string } },
): number => {
    const sa = SEVERITY_ORDER[(a.vulnerability.severity ?? "UNKNOWN").toUpperCase()] ?? UNKNOWN_LEVEL;
    const sb = SEVERITY_ORDER[(b.vulnerability.severity ?? "UNKNOWN").toUpperCase()] ?? UNKNOWN_LEVEL;

    return sa - sb || a.packageName.localeCompare(b.packageName) || a.packageVersion.localeCompare(b.packageVersion);
};

/**
 * `true` when a finding's severity is at or above the configured filter
 * threshold (i.e., should be reported).
 */
export const severityPassesFilter = (severity: string, filter: SeverityFilter): boolean => {
    const filterLevel = SEVERITY_ORDER[filter.toUpperCase()] ?? MODERATE_LEVEL;
    const vulnLevel = SEVERITY_ORDER[severity.toUpperCase()] ?? UNKNOWN_LEVEL;

    return vulnLevel <= filterLevel;
};
