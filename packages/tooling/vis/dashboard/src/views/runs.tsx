import { useQuery } from "@tanstack/react-query";
import arrowRightIcon from "lucide-static/icons/arrow-right.svg?raw";

import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMs, formatRelative } from "@/lib/format";

interface RunsViewProps {
    onSelect: (runId: string) => void;
}

export const RunsView = ({ onSelect }: RunsViewProps) => {
    const runsQuery = useQuery({ queryFn: api.runs, queryKey: queryKeys.runs() });

    if (runsQuery.isLoading) {
        return <Skeleton label="LOADING RUNS" />;
    }

    if (runsQuery.isError) {
        return (
            <div className="border border-dashed border-accent bg-panel px-8 py-16" role="alert">
                <div className="nd-mono mb-3 text-[12px] uppercase tracking-[0.16em] text-accent">[FAILED TO LOAD RUNS]</div>
                <p className="text-[14px] text-faint">{runsQuery.error instanceof Error ? runsQuery.error.message : "Unknown error."}</p>
            </div>
        );
    }

    const runs = runsQuery.data?.runs ?? [];

    if (runs.length === 0) {
        return (
            <div className="border border-dashed border-border2 bg-panel px-8 py-16">
                <div className="nd-mono mb-3 text-[12px] uppercase tracking-[0.16em] text-muted">[NO RUNS RECORDED]</div>
                <p className="text-[14px] text-faint">
                    Run
{" "}
<code className="nd-mono px-1 text-fg">vis run &lt;target&gt;</code>
{" "}
to populate history.
                </p>
            </div>
        );
    }

    return (
        <div className="border border-border bg-panel">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>STARTED</TableHead>
                        <TableHead>DURATION</TableHead>
                        <TableHead>TASKS</TableHead>
                        <TableHead>CACHED</TableHead>
                        <TableHead>FAILED</TableHead>
                        <TableHead aria-label="Open run details" className="text-right" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {runs.map((run) => {
                        const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>): void => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onSelect(run.id);
                            }
                        };

                        return (
                            <TableRow
                                aria-label={`Open run ${run.id}`}
                                className="cursor-pointer"
                                key={run.id}
                                onClick={() => {
                                    onSelect(run.id);
                                }}
                                onKeyDown={handleRowKeyDown}
                                role="button"
                                tabIndex={0}
                            >
                                <TableCell>
                                    <div className="text-[13px] text-fg">{formatDate(run.startTime)}</div>
                                    <div className="nd-mono text-[11px] uppercase tracking-[0.12em] text-faint">{formatRelative(run.startTime)}</div>
                                </TableCell>
                                <TableCell className="nd-mono text-[13px]">{formatMs(run.duration)}</TableCell>
                                <TableCell className="nd-mono text-[13px]">{run.stats?.total ?? "—"}</TableCell>
                                <TableCell>
                                    {(run.stats?.cached ?? 0) > 0
                                        ? (
                                        <Badge variant="success">{run.stats?.cached}</Badge>
                                        )
                                        : (
                                        <span className="nd-mono text-[13px] text-faint">0</span>
                                        )}
                                </TableCell>
                                <TableCell>
                                    {(run.stats?.failed ?? 0) > 0
                                        ? (
                                        <Badge variant="destructive">{run.stats?.failed}</Badge>
                                        )
                                        : (
                                        <span className="nd-mono text-[13px] text-faint">0</span>
                                        )}
                                </TableCell>
                                <TableCell className="text-right text-faint">
                                    <Icon aria-label="Open run" svg={arrowRightIcon} />
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};
