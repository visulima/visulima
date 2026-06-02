import type { AdapterId, Finding, FindingSeverity } from "./config-types";

/**
 * Aggregated lint/fmt results across one or more adapter runs.
 *
 * Reporters consume this — keep the surface minimal and per-adapter
 * details accessible so the human reporter can group / colorize and
 * the JSON reporter can serialize without re-walking findings.
 */
export interface AggregateResult {
    /** Every finding produced, in adapter-then-file order. */
    findings: ReadonlyArray<Finding>;
    /** True when at least one run exited non-zero. */
    hadProcessFailure: boolean;
    /** Highest severity observed; `undefined` when there are no findings. */
    maxSeverity?: FindingSeverity;
    /** Per-adapter run metadata. */
    runs: ReadonlyArray<AdapterRunSummary>;
}

export interface AdapterRunSummary {
    adapter: AdapterId;
    durationMs: number;
    exitCode: number | null;
    findingCount: number;
}

/**
 * Severity ordering used by `aggregate` to compute `maxSeverity` and
 * by reporters that want to filter (e.g. `--quiet` drops `info`).
 */
const SEVERITY_RANK: Record<FindingSeverity, number> = {
    error: 3,
    info: 1,
    warning: 2,
};

/**
 * Compare two severities by rank (`error` > `warning` > `info`).
 * @param a First severity.
 * @param b Second severity.
 * @returns Negative when `a` ranks below `b`, positive when above, zero when equal.
 */
export const compareSeverity = (a: FindingSeverity, b: FindingSeverity): number => SEVERITY_RANK[a] - SEVERITY_RANK[b];

/**
 * Combine findings + per-adapter metadata into a single AggregateResult.
 *
 * Findings are kept in input order — callers are expected to pass
 * them already ordered (adapter precedence × file path). Sorting here
 * would hide bugs in the orchestration layer.
 * @param entries Per-adapter run metadata plus that run's findings.
 * @returns The combined findings, per-adapter summaries, max severity, and failure flag.
 */
export const aggregate = (entries: ReadonlyArray<AdapterRunSummary & { findings: ReadonlyArray<Finding> }>): AggregateResult => {
    const findings: Finding[] = [];
    const runs: AdapterRunSummary[] = [];
    let maxSeverity: FindingSeverity | undefined;
    let hadProcessFailure = false;

    for (const entry of entries) {
        runs.push({
            adapter: entry.adapter,
            durationMs: entry.durationMs,
            exitCode: entry.exitCode,
            findingCount: entry.findings.length,
        });

        if (entry.exitCode !== 0 && entry.exitCode !== null // Some linters (eslint) exit 1 purely because they found issues —
            // that's not a process failure. We only flag failures the parse
            // layer couldn't account for: zero findings but non-zero exit.
            && entry.findings.length === 0) {
            hadProcessFailure = true;
        }

        for (const finding of entry.findings) {
            findings.push(finding);

            if (!maxSeverity || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[maxSeverity]) {
                maxSeverity = finding.severity;
            }
        }
    }

    return { findings, hadProcessFailure, maxSeverity, runs };
};

/**
 * Group findings by file path. Used by reporters that present a
 * per-file view (most human-readable output and editor integrations).
 * @param findings Findings to group.
 * @returns Map of file path to its findings, in first-seen order.
 */
export const groupFindingsByFile = (findings: ReadonlyArray<Finding>): Map<string, Finding[]> => {
    const out = new Map<string, Finding[]>();

    for (const finding of findings) {
        const bucket = out.get(finding.file);

        if (bucket) {
            bucket.push(finding);
        } else {
            out.set(finding.file, [finding]);
        }
    }

    return out;
};

/**
 * Compute the conventional exit code from an AggregateResult.
 *
 * - `0` — no errors and no process failures.
 * - `1` — at least one error finding or process-level failure.
 *
 * Warnings alone do not fail the run — that's `--max-warnings`' job
 * (each adapter applies its own threshold and emits errors when
 * exceeded).
 * @param result The aggregated run result.
 * @returns `1` on any error finding or process failure, otherwise `0`.
 */
export const exitCodeFor = (result: AggregateResult): number => {
    if (result.hadProcessFailure) {
        return 1;
    }

    return result.maxSeverity === "error" ? 1 : 0;
};
