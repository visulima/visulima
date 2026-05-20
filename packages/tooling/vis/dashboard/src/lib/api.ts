export interface TaskMetric {
    taskId: string;
    project: string;
    target: string;
    runs: number;
    hits: number;
    misses: number;
    failures: number;
    hitRate: number;
    averageDurationMs: number;
    timeSavedMs: number;
}

export interface TimeSeriesPoint {
    timestamp: string;
    value: number;
}

export interface DashboardMetrics {
    totals: {
        runs: number;
        tasks: number;
        succeeded: number;
        failed: number;
        cached: number;
        skipped: number;
        totalDurationMs: number;
        estimatedTimeSavedMs: number;
    };
    cacheHitRate: number | null;
    averageRunDurationMs: number | null;
    medianRunDurationMs: number | null;
    slowestTasks: TaskMetric[];
    mostCachedTasks: TaskMetric[];
    mostInvalidatedTasks: TaskMetric[];
    hitRateOverTime: TimeSeriesPoint[];
    durationOverTime: TimeSeriesPoint[];
}

export interface FlakyTask {
    taskId: string;
    project: string;
    target: string;
    totalRuns: number;
    failures: number;
    successes: number;
    flakinessRate: number;
    lastFailure?: string;
}

export interface OverviewPayload {
    metrics: DashboardMetrics;
    flaky: FlakyTask[];
}

export interface RunListItem {
    id: string;
    startTime: string;
    endTime: string;
    duration: number;
    stats?: {
        total?: number;
        succeeded?: number;
        failed?: number;
        cached?: number;
        skipped?: number;
    };
}

export interface TaskSummary {
    taskId: string;
    cacheStatus: "HIT" | "MISS" | "REMOTE_HIT" | "SKIPPED";
    duration?: number;
    startTime?: string;
    endTime?: string;
    exitCode?: number;
    hash?: string;
    cacheable: boolean;
    dependencies: string[];
    target: { project: string; target: string; configuration?: string };
}

export interface RunDetail {
    id: string;
    startTime: string;
    endTime: string;
    duration: number;
    environment: { arch: string; nodeVersion: string; platform: string };
    stats: {
        total: number;
        succeeded: number;
        failed: number;
        cached: number;
        skipped: number;
    };
    tasks: TaskSummary[];
}

export interface HashDiffEntry {
    kind: "command" | "implicitDeps" | "nodes" | "runtime";
    key: string;
    previous: string | undefined;
    current: string | undefined;
    change: "added" | "removed" | "modified";
}

export interface CacheMissAnalysis {
    taskId: string;
    currentHash?: string;
    previousHash?: string;
    previousRunId?: string;
    previousRunStartTime?: string;
    reason: string;
    entries: HashDiffEntry[];
}

export interface CacheEntry {
    hash: string;
    sizeBytes: number;
    ageMs: number;
    mtimeIso: string;
}

export interface CachePayload {
    directory: string;
    exists: boolean;
    totalBytes: number;
    entries: CacheEntry[];
}

export interface EnvironmentPayload {
    workspaceRoot: string;
    cacheDirectory: string;
    node: string;
    platform: string;
    arch: string;
}

const fetchJson = async <T>(path: string): Promise<T> => {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`${String(response.status)} ${response.statusText}: ${path}`);
    }

    return (await response.json()) as T;
};

export const api = {
    overview: (): Promise<OverviewPayload> => fetchJson("/api/overview"),
    runs: (): Promise<{ runs: RunListItem[] }> => fetchJson("/api/runs"),
    run: (id: string): Promise<RunDetail> => fetchJson(`/api/runs/${encodeURIComponent(id)}`),
    cache: (): Promise<CachePayload> => fetchJson("/api/cache"),
    environment: (): Promise<EnvironmentPayload> => fetchJson("/api/environment"),
    diff: (runId: string, taskId: string): Promise<CacheMissAnalysis> =>
        fetchJson(`/api/runs/${encodeURIComponent(runId)}/tasks/${encodeURIComponent(taskId)}/diff`),
};

export const queryKeys = {
    overview: () => ["overview"] as const,
    runs: () => ["runs"] as const,
    run: (id: string) => ["run", id] as const,
    cache: () => ["cache"] as const,
    environment: () => ["environment"] as const,
    diff: (runId: string, taskId: string) => ["diff", runId, taskId] as const,
};
