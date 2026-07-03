export interface TaskMetric {
    averageDurationMs: number;
    failures: number;
    hitRate: number;
    hits: number;
    misses: number;
    project: string;
    runs: number;
    target: string;
    taskId: string;
    timeSavedMs: number;
}

export interface TimeSeriesPoint {
    timestamp: string;
    value: number;
}

export interface DashboardMetrics {
    averageRunDurationMs: number | null;
    cacheHitRate: number | null;
    durationOverTime: TimeSeriesPoint[];
    hitRateOverTime: TimeSeriesPoint[];
    medianRunDurationMs: number | null;
    mostCachedTasks: TaskMetric[];
    mostInvalidatedTasks: TaskMetric[];
    slowestTasks: TaskMetric[];
    totals: {
        cached: number;
        estimatedTimeSavedMs: number;
        failed: number;
        runs: number;
        skipped: number;
        succeeded: number;
        tasks: number;
        totalDurationMs: number;
    };
}

export interface FlakyTask {
    failures: number;
    flakinessRate: number;
    lastFailure?: string;
    project: string;
    successes: number;
    target: string;
    taskId: string;
    totalRuns: number;
}

export interface OverviewPayload {
    flaky: FlakyTask[];
    metrics: DashboardMetrics;
}

export interface RunListItem {
    duration: number;
    endTime: string;
    id: string;
    startTime: string;
    stats?: {
        cached?: number;
        failed?: number;
        skipped?: number;
        succeeded?: number;
        total?: number;
    };
}

export interface TaskSummary {
    cacheable: boolean;
    cacheStatus: "HIT" | "MISS" | "REMOTE_HIT" | "SKIPPED";
    dependencies: string[];
    duration?: number;
    endTime?: string;
    exitCode?: number;
    hash?: string;
    startTime?: string;
    target: { configuration?: string; project: string; target: string };
    taskId: string;
}

export interface RunDetail {
    duration: number;
    endTime: string;
    environment: { arch: string; nodeVersion: string; platform: string };
    id: string;
    startTime: string;
    stats: {
        cached: number;
        failed: number;
        skipped: number;
        succeeded: number;
        total: number;
    };
    tasks: TaskSummary[];
}

export interface HashDiffEntry {
    change: "added" | "removed" | "modified";
    current: string | undefined;
    key: string;
    kind: "command" | "implicitDeps" | "nodes" | "runtime";
    previous: string | undefined;
}

export interface CacheMissAnalysis {
    currentHash?: string;
    entries: HashDiffEntry[];
    previousHash?: string;
    previousRunId?: string;
    previousRunStartTime?: string;
    reason: string;
    taskId: string;
}

export interface CacheEntry {
    ageMs: number;
    hash: string;
    mtimeIso: string;
    sizeBytes: number;
}

export interface CachePayload {
    directory: string;
    entries: CacheEntry[];
    exists: boolean;
    totalBytes: number;
}

export interface EnvironmentPayload {
    arch: string;
    cacheDirectory: string;
    node: string;
    platform: string;
    workspaceRoot: string;
}

const fetchJson = async <T>(path: string): Promise<T> => {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`${String(response.status)} ${response.statusText}: ${path}`);
    }

    return (await response.json()) as T;
};

export const api = {
    cache: (): Promise<CachePayload> => fetchJson("/api/cache"),
    diff: (runId: string, taskId: string): Promise<CacheMissAnalysis> =>
        fetchJson(`/api/runs/${encodeURIComponent(runId)}/tasks/${encodeURIComponent(taskId)}/diff`),
    environment: (): Promise<EnvironmentPayload> => fetchJson("/api/environment"),
    overview: (): Promise<OverviewPayload> => fetchJson("/api/overview"),
    run: (id: string): Promise<RunDetail> => fetchJson(`/api/runs/${encodeURIComponent(id)}`),
    runs: (): Promise<{ runs: RunListItem[] }> => fetchJson("/api/runs"),
};

export const queryKeys = {
    cache: () => ["cache"] as const,
    diff: (runId: string, taskId: string) => ["diff", runId, taskId] as const,
    environment: () => ["environment"] as const,
    overview: () => ["overview"] as const,
    run: (id: string) => ["run", id] as const,
    runs: () => ["runs"] as const,
};
