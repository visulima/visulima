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
    /** Per-adapter run metadata. */
    runs: ReadonlyArray<AdapterRunSummary>;
    /** Highest severity observed; `undefined` when there are no findings. */
    maxSeverity?: FindingSeverity;
    /** True when at least one run exited non-zero. */
    hadProcessFailure: boolean;
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

export const compareSeverity = (a: FindingSeverity, b: FindingSeverity): number => SEVERITY_RANK[a] - SEVERITY_RANK[b];

/**
 * Combine findings + per-adapter metadata into a single AggregateResult.
 *
 * Findings are kept in input order — callers are expected to pass
 * them already ordered (adapter precedence × file path). Sorting here
 * would hide bugs in the orchestration layer.
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

        if (entry.exitCode !== 0 && entry.exitCode !== null) {
            // Some linters (eslint) exit 1 purely because they found issues —
            // that's not a process failure. We only flag failures the parse
            // layer couldn't account for: zero findings but non-zero exit.
            if (entry.findings.length === 0) {
                hadProcessFailure = true;
            }
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
 */
export const exitCodeFor = (result: AggregateResult): number => {
    if (result.hadProcessFailure) {
        return 1;
    }

    return result.maxSeverity === "error" ? 1 : 0;
};
