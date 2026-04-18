import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMs } from "@/lib/format";

import { CacheMissDiff } from "./cache-miss-diff";

interface RunDetailProps {
    runId: string;
    onBack: () => void;
}

export const RunDetail = ({ runId, onBack }: RunDetailProps) => {
    const runQuery = useQuery({ queryKey: queryKeys.run(runId), queryFn: () => api.run(runId) });
    const [selectedTask, setSelectedTask] = useState<string | null>(null);

    if (selectedTask) {
        return <CacheMissDiff runId={runId} taskId={selectedTask} onBack={() => setSelectedTask(null)} />;
    }

    if (runQuery.isLoading) {
        return <Skeleton className="h-96" />;
    }

    if (!runQuery.data) {
        return (
            <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">Run not found.</CardContent>
            </Card>
        );
    }

    const run = runQuery.data;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> All runs
                </Button>
                <div>
                    <div className="text-xs text-muted-foreground">Run</div>
                    <div className="font-mono text-sm">{run.id}</div>
                </div>
                <div className="ml-auto text-xs text-muted-foreground">
                    {formatDate(run.startTime)} · {formatMs(run.duration)}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <StatCard label="Total" value={run.stats.total} />
                <StatCard label="Succeeded" tone="good" value={run.stats.succeeded} />
                <StatCard label="Cached" value={run.stats.cached} />
                <StatCard
                    label="Failed"
                    tone={run.stats.failed > 0 ? "bad" : "default"}
                    value={run.stats.failed}
                />
            </div>

            <Card>
                <CardContent className="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Hash</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {run.tasks.map((task) => (
                                <TableRow key={task.taskId}>
                                    <TableCell className="font-mono text-xs">{task.taskId}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={task.cacheStatus} />
                                    </TableCell>
                                    <TableCell>{formatMs(task.duration)}</TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {task.hash ? task.hash.slice(0, 12) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {task.cacheStatus === "MISS" ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedTask(task.taskId)}
                                            >
                                                Why missed?
                                            </Button>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};
