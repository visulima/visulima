import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, queryKeys } from "@/lib/api";
import { formatDate, formatMs, formatRelative } from "@/lib/format";

interface RunsViewProps {
    onSelect: (runId: string) => void;
}

export const RunsView = ({ onSelect }: RunsViewProps) => {
    const runsQuery = useQuery({ queryKey: queryKeys.runs(), queryFn: api.runs });

    if (runsQuery.isLoading) {
        return <Skeleton className="h-64" />;
    }

    const runs = runsQuery.data?.runs ?? [];

    if (runs.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No recorded runs yet. Run <code className="rounded bg-muted px-1 py-0.5 font-mono">vis run &lt;target&gt;</code> to
                    populate history.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="px-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Started</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Tasks</TableHead>
                            <TableHead>Cached</TableHead>
                            <TableHead>Failed</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {runs.map((run) => (
                            <TableRow
                                key={run.id}
                                className="cursor-pointer"
                                onClick={() => onSelect(run.id)}
                            >
                                <TableCell>
                                    <div>{formatDate(run.startTime)}</div>
                                    <div className="text-xs text-muted-foreground">{formatRelative(run.startTime)}</div>
                                </TableCell>
                                <TableCell>{formatMs(run.duration)}</TableCell>
                                <TableCell>{run.stats?.total ?? "—"}</TableCell>
                                <TableCell>
                                    {(run.stats?.cached ?? 0) > 0 ? (
                                        <Badge variant="success">{run.stats?.cached}</Badge>
                                    ) : (
                                        <span className="text-muted-foreground">0</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {(run.stats?.failed ?? 0) > 0 ? (
                                        <Badge variant="destructive">{run.stats?.failed}</Badge>
                                    ) : (
                                        <span className="text-muted-foreground">0</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">View →</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
