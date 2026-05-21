import { useQuery } from "@tanstack/react-query";

import { SegmentedBar } from "@/components/segmented-bar";
import { Sparkline } from "@/components/sparkline";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TaskMetric } from "@/lib/api";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMs, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const SectionTitle = ({ children, ord }: { children: React.ReactNode; ord: string }) => (
    <div className="mb-6 flex items-baseline gap-4">
        <span className="nd-mono text-[11px] tracking-[0.16em] text-faint">{ord}</span>
        <h2 className="nd-mono text-[11px] uppercase tracking-[0.16em] text-muted">{children}</h2>
        <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
);

const taskRow = (metric: TaskMetric) => (
    <TableRow key={metric.taskId}>
        <TableCell className="nd-mono text-[12px] text-fg">{metric.taskId}</TableCell>
        <TableCell className="nd-mono text-[13px]">{metric.runs}</TableCell>
        <TableCell className="nd-mono text-[13px]">{formatPercent(metric.hitRate)}</TableCell>
        <TableCell className="nd-mono text-[13px]">{formatMs(metric.averageDurationMs)}</TableCell>
        <TableCell className="nd-mono text-[13px] text-success">{formatMs(metric.timeSavedMs)}</TableCell>
    </TableRow>
);

export const Overview = () => {
    const overviewQuery = useQuery({ queryFn: api.overview, queryKey: queryKeys.overview() });

    if (overviewQuery.isLoading) {
        return <Skeleton label="LOADING OVERVIEW" />;
    }

    if (!overviewQuery.data) {
        return (
            <div className="nd-mono py-16 text-center text-[12px] uppercase tracking-[0.16em] text-muted">
                [NO DATA]
            </div>
        );
    }

    const { flaky, metrics } = overviewQuery.data;
    const { totals } = metrics;
    const hitRate = metrics.cacheHitRate ?? 0;
    const hitTone: "good" | "warn" | "bad" = hitRate >= 0.6 ? "good" : hitRate >= 0.3 ? "warn" : "bad";

    return (
        <div className="flex flex-col gap-16">
            {/* HERO: Cache hit rate */}
            <section className="grid gap-12 md:grid-cols-[1.4fr_1fr]">
                <StatCard
                    label="[01] · CACHE HIT RATE"
                    sub={`${totals.cached.toLocaleString()} of ${totals.tasks.toLocaleString()} task executions`}
                    tone={hitTone}
                    unit="%"
                    value={(hitRate * 100).toFixed(1)}
                    variant="hero"
                >
                    <SegmentedBar
                        className="mt-4"
                        max={1}
                        segments={40}
                        size="hero"
                        tone={hitTone}
                        value={hitRate}
                    />
                </StatCard>

                <div className="flex flex-col">
                    <StatCard
                        label="TIME SAVED"
                        tone="good"
                        value={formatMs(totals.estimatedTimeSavedMs)}
                        variant="stat"
                    />
                    <StatCard
                        label="AVG RUN"
                        value={formatMs(metrics.averageRunDurationMs)}
                        variant="stat"
                    />
                    <StatCard
                        label="MEDIAN RUN"
                        value={formatMs(metrics.medianRunDurationMs)}
                        variant="stat"
                    />
                    <StatCard
                        label="RECORDED RUNS"
                        value={totals.runs.toLocaleString()}
                        variant="stat"
                    />
                    <StatCard
                        label="TASK EXECUTIONS"
                        value={totals.tasks.toLocaleString()}
                        variant="stat"
                    />
                </div>
            </section>

            {/* TRENDS */}
            <section>
                <SectionTitle ord="02">TRENDS</SectionTitle>
                <div className="grid gap-8 md:grid-cols-2">
                    <div className="border border-border bg-panel p-6">
                        <div className="nd-label mb-4">CACHE HIT RATE / TIME</div>
                        <Sparkline height={96} points={metrics.hitRateOverTime} />
                    </div>
                    <div className="border border-border bg-panel p-6">
                        <div className="nd-label mb-4">RUN DURATION / TIME</div>
                        <Sparkline height={96} points={metrics.durationOverTime} />
                    </div>
                </div>
            </section>

            {/* MOST CACHED */}
            <section>
                <SectionTitle ord="03">MOST TIME SAVED · BY TASK</SectionTitle>
                {metrics.mostCachedTasks.length === 0
                    ? (
                    <div className="nd-mono border border-dashed border-border2 px-6 py-8 text-[12px] uppercase tracking-[0.16em] text-faint">
                        [NO CACHED TASKS YET]
                    </div>
                    )
                    : (
                    <div className="border border-border bg-panel">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>TASK</TableHead>
                                    <TableHead>RUNS</TableHead>
                                    <TableHead>HIT RATE</TableHead>
                                    <TableHead>AVG DURATION</TableHead>
                                    <TableHead>SAVED</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>{metrics.mostCachedTasks.map(taskRow)}</TableBody>
                        </Table>
                    </div>
                    )}
            </section>

            {/* SLOWEST / INVALIDATED */}
            <section className="grid gap-8 md:grid-cols-2">
                <div>
                    <SectionTitle ord="04">SLOWEST TASKS</SectionTitle>
                    {metrics.slowestTasks.length === 0
                        ? (
                        <div className="nd-mono border border-dashed border-border2 px-6 py-8 text-[12px] uppercase tracking-[0.16em] text-faint">
                            [NO TIMING DATA]
                        </div>
                        )
                        : (
                        <div className="border border-border bg-panel">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>TASK</TableHead>
                                        <TableHead>AVG</TableHead>
                                        <TableHead>EXEC</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {metrics.slowestTasks.map((t) => (
                                        <TableRow key={t.taskId}>
                                            <TableCell className="nd-mono text-[12px] text-fg">{t.taskId}</TableCell>
                                            <TableCell className="nd-mono text-[13px]">{formatMs(t.averageDurationMs)}</TableCell>
                                            <TableCell className="nd-mono text-[13px]">{t.misses}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        )}
                </div>
                <div>
                    <SectionTitle ord="05">MOST INVALIDATED</SectionTitle>
                    {metrics.mostInvalidatedTasks.length === 0
                        ? (
                        <div className="nd-mono border border-dashed border-border2 px-6 py-8 text-[12px] uppercase tracking-[0.16em] text-faint">
                            [NO INVALIDATIONS]
                        </div>
                        )
                        : (
                        <div className="border border-border bg-panel">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>TASK</TableHead>
                                        <TableHead>MISS RATE</TableHead>
                                        <TableHead>RUNS</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {metrics.mostInvalidatedTasks.map((t) => {
                                        const missRate = t.misses / Math.max(1, t.runs);

                                        return (
                                            <TableRow key={t.taskId}>
                                                <TableCell className="nd-mono text-[12px] text-fg">{t.taskId}</TableCell>
                                                <TableCell className={cn("nd-mono text-[13px]", missRate > 0.5 ? "text-accent" : "text-warning")}>
                                                    {formatPercent(missRate)}
                                                </TableCell>
                                                <TableCell className="nd-mono text-[13px]">{t.runs}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        )}
                </div>
            </section>

            {/* FLAKY (if present) */}
            {flaky.length > 0
                ? (
                <section>
                    <div className="mb-6 flex items-baseline gap-4">
                        <span className="nd-mono text-[11px] tracking-[0.16em] text-faint">06</span>
                        <h2 className="nd-mono text-[11px] uppercase tracking-[0.16em] text-accent">FLAKY TASKS</h2>
                        <span aria-hidden className="h-px flex-1 bg-accent/40" />
                        <span className="nd-mono text-[11px] uppercase tracking-[0.12em] text-accent">
[
{flaky.length}
]
                        </span>
                    </div>
                    <div className="border border-accent/60 bg-panel">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>TASK</TableHead>
                                    <TableHead>RUNS</TableHead>
                                    <TableHead>FAILURES</TableHead>
                                    <TableHead>RATE</TableHead>
                                    <TableHead>LAST FAILURE</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {flaky.map((f) => (
                                    <TableRow key={f.taskId}>
                                        <TableCell className="nd-mono text-[12px] text-fg">{f.taskId}</TableCell>
                                        <TableCell className="nd-mono text-[13px]">{f.totalRuns}</TableCell>
                                        <TableCell className="nd-mono text-[13px] text-accent">{f.failures}</TableCell>
                                        <TableCell className="nd-mono text-[13px] text-accent">{formatPercent(f.flakinessRate)}</TableCell>
                                        <TableCell className="nd-mono text-[12px] text-muted">{formatDate(f.lastFailure)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </section>
                )
                : null}
        </div>
    );
};
