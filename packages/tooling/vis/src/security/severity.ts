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
 * `true` when a finding's severity is at or above the configured filter
 * threshold (i.e., should be reported).
 */
export const severityPassesFilter = (severity: string, filter: SeverityFilter): boolean => {
    const filterLevel = SEVERITY_ORDER[filter.toUpperCase()] ?? MODERATE_LEVEL;
    const vulnLevel = SEVERITY_ORDER[severity.toUpperCase()] ?? UNKNOWN_LEVEL;

    return vulnLevel <= filterLevel;
};
