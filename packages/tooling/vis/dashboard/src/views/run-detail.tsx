import { useQuery } from "@tanstack/react-query";
import arrowLeftIcon from "lucide-static/icons/arrow-left.svg?raw";
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?raw";
import chevronRightIcon from "lucide-static/icons/chevron-right.svg?raw";
import searchIcon from "lucide-static/icons/search.svg?raw";
import { Fragment, useCallback, useState } from "react";

import { Icon } from "@/components/icon";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMs } from "@/lib/format";

import { CacheMissAccordion } from "./cache-miss-accordion";

interface RunDetailProps {
    onBack: () => void;
    runId: string;
}

export const RunDetail = ({ onBack, runId }: RunDetailProps) => {
    const runQuery = useQuery({ queryFn: () => api.run(runId), queryKey: queryKeys.run(runId) });
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

    const toggleExpanded = useCallback((taskId: string) => {
        setExpanded((previous) => {
            const next = new Set(previous);

            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }

            return next;
        });
    }, []);

    if (runQuery.isLoading) {
        return <Skeleton label="LOADING RUN" />;
    }

    if (!runQuery.data) {
        return (
            <div className="nd-mono py-16 text-center text-[12px] uppercase tracking-[0.16em] text-muted">
                [RUN NOT FOUND]
            </div>
        );
    }

    const run = runQuery.data;

    return (
        <div className="flex flex-col gap-12">
            {/* Back nav + identifier */}
            <div className="flex items-baseline justify-between gap-4 border-b border-border pb-6">
                <div className="flex items-baseline gap-6">
                    <Button onClick={onBack} size="sm" variant="ghost">
                        <Icon svg={arrowLeftIcon} />
                        ALL RUNS
                    </Button>
                    <div>
                        <div className="nd-label mb-1">RUN ID</div>
                        <div className="nd-mono text-[14px] text-fg">{run.id}</div>
                    </div>
                </div>
                <div className="flex items-end gap-6 text-right">
                    <div>
                        <div className="nd-label">STARTED</div>
                        <div className="nd-mono text-[13px] text-fg">{formatDate(run.startTime)}</div>
                    </div>
                    <div>
                        <div className="nd-label">DURATION</div>
                        <div className="nd-mono text-[13px] text-fg">{formatMs(run.duration)}</div>
                    </div>
                </div>
            </div>

            {/* Stats grid */}
            <section className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
                <StatCard className="border-0 bg-panel" label="TOTAL" value={run.stats.total} />
                <StatCard className="border-0 bg-panel" label="SUCCEEDED" tone="good" value={run.stats.succeeded} />
                <StatCard className="border-0 bg-panel" label="CACHED" value={run.stats.cached} />
                <StatCard
                    className="border-0 bg-panel"
                    label="FAILED"
                    tone={run.stats.failed > 0 ? "bad" : "default"}
                    value={run.stats.failed}
                />
            </section>

            {/* Task table */}
            <section>
                <div className="mb-6 flex items-baseline gap-4">
                    <span className="nd-mono text-[11px] tracking-[0.16em] text-faint">02</span>
                    <h2 className="nd-mono text-[11px] uppercase tracking-[0.16em] text-muted">TASKS</h2>
                    <span aria-hidden className="h-px flex-1 bg-border" />
                </div>
                <div className="border border-border bg-panel">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>TASK</TableHead>
                                <TableHead>STATUS</TableHead>
                                <TableHead>DURATION</TableHead>
                                <TableHead>HASH</TableHead>
                                <TableHead className="text-right" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {run.tasks.map((task) => {
                                const isOpen = expanded.has(task.taskId);
                                const isMiss = task.cacheStatus === "MISS";

                                return (
                                    <Fragment key={task.taskId}>
                                        <TableRow>
                                            <TableCell className="nd-mono text-[12px] text-fg">{task.taskId}</TableCell>
                                            <TableCell>
                                                <StatusBadge status={task.cacheStatus} />
                                            </TableCell>
                                            <TableCell className="nd-mono text-[13px]">{formatMs(task.duration)}</TableCell>
                                            <TableCell className="nd-mono text-[12px] text-muted">
                                                {task.hash ? `${task.hash.slice(0, 12)}…` : "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isMiss
                                                    ? (
                                                    <Button
                                                        aria-controls={`why-missed-${task.taskId}`}
                                                        aria-expanded={isOpen}
                                                        onClick={() => { toggleExpanded(task.taskId); }}
                                                        size="sm"
                                                        variant="technical"
                                                    >
                                                        <Icon svg={searchIcon} />
                                                        WHY MISSED
                                                        <Icon svg={isOpen ? chevronDownIcon : chevronRightIcon} />

                                                    </Button>
                                                    )
                                                    : null}
                                            </TableCell>
                                        </TableRow>
                                        {isMiss && isOpen
                                            ? (
                                            <tr className="bg-bg/40" id={`why-missed-${task.taskId}`}>
                                                <td className="border-b border-border p-0" colSpan={5}>
                                                    <CacheMissAccordion runId={runId} taskId={task.taskId} />
                                                </td>
                                            </tr>
                                            )
                                            : null}
                                    </Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    );
};
