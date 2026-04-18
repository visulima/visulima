import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Database, Gauge, TimerReset, Zap } from "lucide-react";

import { Sparkline } from "@/components/sparkline";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, queryKeys, type TaskMetric } from "@/lib/api";
import { formatDate, formatMs, formatPercent } from "@/lib/format";

const taskRow = (metric: TaskMetric) => (
    <TableRow key={metric.taskId}>
        <TableCell className="font-mono text-xs">{metric.taskId}</TableCell>
        <TableCell>{metric.runs}</TableCell>
        <TableCell>{formatPercent(metric.hitRate)}</TableCell>
        <TableCell>{formatMs(metric.averageDurationMs)}</TableCell>
        <TableCell className="text-emerald-400">{formatMs(metric.timeSavedMs)}</TableCell>
    </TableRow>
);

export const Overview = () => {
    const overviewQuery = useQuery({ queryKey: queryKeys.overview(), queryFn: api.overview });

    if (overviewQuery.isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-24" />
                ))}
            </div>
        );
    }

    if (!overviewQuery.data) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No data yet.</CardContent>
            </Card>
        );
    }

    const { metrics, flaky } = overviewQuery.data;
    const { totals } = metrics;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Cache hit rate"
                    icon={Database}
                    tone={(metrics.cacheHitRate ?? 0) > 0.5 ? "good" : "warn"}
                    value={formatPercent(metrics.cacheHitRate)}
                    sub={`${totals.cached} / ${totals.tasks} tasks`}
                />
                <StatCard
                    label="Time saved"
                    icon={Zap}
                    tone="good"
                    value={formatMs(totals.estimatedTimeSavedMs)}
                    sub="Estimated vs. re-execution"
                />
                <StatCard
                    label="Avg run duration"
                    icon={Clock}
                    value={formatMs(metrics.averageRunDurationMs)}
                    sub={`median ${formatMs(metrics.medianRunDurationMs)}`}
                />
                <StatCard
                    label="Recorded runs"
                    icon={TimerReset}
                    value={totals.runs}
                    sub={`${totals.tasks} task executions`}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Cache hit rate over time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Sparkline points={metrics.hitRateOverTime} stroke="var(--chart-4)" fill="var(--chart-4)" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Run duration trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Sparkline points={metrics.durationOverTime} stroke="var(--chart-1)" fill="var(--chart-1)" />
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Most time saved by cache</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                    {metrics.mostCachedTasks.length === 0 ? (
                        <div className="px-5 py-6 text-sm text-muted-foreground">No cached tasks yet.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Task</TableHead>
                                    <TableHead>Runs</TableHead>
                                    <TableHead>Hit rate</TableHead>
                                    <TableHead>Avg duration</TableHead>
                                    <TableHead>Saved</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>{metrics.mostCachedTasks.map(taskRow)}</TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Slowest tasks</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0">
                        {metrics.slowestTasks.length === 0 ? (
                            <div className="px-5 py-6 text-sm text-muted-foreground">No timing data.</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Task</TableHead>
                                        <TableHead>Avg duration</TableHead>
                                        <TableHead>Executions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {metrics.slowestTasks.map((t) => (
                                        <TableRow key={t.taskId}>
                                            <TableCell className="font-mono text-xs">{t.taskId}</TableCell>
                                            <TableCell>{formatMs(t.averageDurationMs)}</TableCell>
                                            <TableCell>{t.misses}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <CardTitle>Most invalidated</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0">
                        {metrics.mostInvalidatedTasks.length === 0 ? (
                            <div className="px-5 py-6 text-sm text-muted-foreground">No invalidations tracked yet.</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Task</TableHead>
                                        <TableHead>Miss rate</TableHead>
                                        <TableHead>Runs</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {metrics.mostInvalidatedTasks.map((t) => (
                                        <TableRow key={t.taskId}>
                                            <TableCell className="font-mono text-xs">{t.taskId}</TableCell>
                                            <TableCell className="text-amber-400">
                                                {formatPercent(t.misses / t.runs)}
                                            </TableCell>
                                            <TableCell>{t.runs}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {flaky.length > 0 ? (
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <CardTitle>Flaky tasks</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Task</TableHead>
                                    <TableHead>Runs</TableHead>
                                    <TableHead>Failures</TableHead>
                                    <TableHead>Rate</TableHead>
                                    <TableHead>Last failure</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {flaky.map((f) => (
                                    <TableRow key={f.taskId}>
                                        <TableCell className="font-mono text-xs">{f.taskId}</TableCell>
                                        <TableCell>{f.totalRuns}</TableCell>
                                        <TableCell className="text-red-400">{f.failures}</TableCell>
                                        <TableCell className="text-red-400">{formatPercent(f.flakinessRate)}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(f.lastFailure)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
};
