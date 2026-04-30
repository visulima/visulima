import { DEFAULT_LOW_SCORE_THRESHOLD } from "../../security/socket-security";
import type { DoctorFinding } from "../../tui/components/doctor/findings";
import type { DoctorResults } from "./sections";

const escapeRegex = (literal: string): string => literal.replaceAll(/[$()+.?[\\\]^{|}]/g, String.raw`\$&`);

const compilePattern = (pattern: string): RegExp => {
    // Convert simple `*` globs to regex; everything else is literal.
    const segments = pattern.split("*").map(escapeRegex);

    return new RegExp(`^${segments.join(".*")}$`, "i");
};

export const parseFilterPatterns = (raw: string | undefined): RegExp[] => {
    if (!raw) {
        return [];
    }

    return raw
        .split(",")
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
        .map(compilePattern);
};

const matchesAny = (name: string, patterns: ReadonlyArray<RegExp>): boolean => {
    for (const pattern of patterns) {
        if (pattern.test(name)) {
            return true;
        }
    }

    return false;
};

/**
 * Narrow a `DoctorResults` to only entries whose package name matches
 * the supplied patterns. Runtime diagnostics are workspace-wide and
 * always pass through — the filter is package-name only.
 */
export const applyFilter = (results: DoctorResults, patterns: ReadonlyArray<RegExp>): DoctorResults => {
    if (patterns.length === 0) {
        return results;
    }

    const outdated = results.outdated.filter((entry) => matchesAny(entry.packageName, patterns));
    const duplicates = results.duplicates.filter((dup) => matchesAny(dup.name, patterns));
    const optimizations = results.optimizations.filter((entry) => matchesAny(entry.packageName, patterns));

    let vulnCount = 0;
    let socketAlerts = 0;
    let socketLowScore = 0;

    for (const entry of outdated) {
        if (entry.vulnerabilities) {
            vulnCount += entry.vulnerabilities.length;
        }

        if (entry.socketReport) {
            socketAlerts += entry.socketReport.alerts.length;

            if (entry.socketReport.score.overall < DEFAULT_LOW_SCORE_THRESHOLD) {
                socketLowScore += 1;
            }
        }
    }

    return {
        ...results,
        duplicates,
        optimizations,
        outdated,
        socketIssues: { alerts: socketAlerts, lowScore: socketLowScore },
        vulnCount,
    };
};

/**
 * Filter a finding list by package name. `runtime` diagnostics have no
 * package and always survive — they're workspace-wide.
 */
export const filterFindingsByPattern = (
    findings: ReadonlyArray<DoctorFinding>,
    patterns: ReadonlyArray<RegExp>,
): DoctorFinding[] => {
    if (patterns.length === 0) {
        return [...findings];
    }

    return findings.filter((finding) => {
        if (finding.kind === "runtime") {
            return true;
        }

        const name = finding.kind === "duplicate"
            ? finding.pkg.name
            : finding.kind === "outdated" || finding.kind === "optimization"
                ? finding.entry.packageName
                : finding.packageName;

        return matchesAny(name, patterns);
    });
};
