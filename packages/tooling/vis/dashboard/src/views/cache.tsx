import { useQuery } from "@tanstack/react-query";
import { Database, HardDrive, Layers } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, queryKeys } from "@/lib/api";
import { formatBytes, formatDate, formatMs } from "@/lib/format";

export const CacheView = () => {
    const cacheQuery = useQuery({ queryKey: queryKeys.cache(), queryFn: api.cache });

    if (cacheQuery.isLoading) {
        return <Skeleton className="h-80" />;
    }

    if (!cacheQuery.data) {
        return (
            <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">No cache data.</CardContent>
            </Card>
        );
    }

    const cache = cacheQuery.data;

    if (!cache.exists) {
        return (
            <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                    No cache directory found at{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono">{cache.directory}</code>.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-3">
                <StatCard icon={Layers} label="Entries" value={cache.entries.length} />
                <StatCard icon={HardDrive} label="Total size" value={formatBytes(cache.totalBytes)} />
                <StatCard
                    icon={Database}
                    label="Newest entry"
                    value={cache.entries[0] ? formatDate(cache.entries[0].mtimeIso) : "—"}
                    sub={cache.directory}
                />
            </div>

            <Card>
                <CardContent className="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Hash</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Age</TableHead>
                                <TableHead>Modified</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cache.entries.slice(0, 200).map((entry) => (
                                <TableRow key={entry.hash}>
                                    <TableCell className="font-mono text-xs">{entry.hash.slice(0, 16)}</TableCell>
                                    <TableCell>{formatBytes(entry.sizeBytes)}</TableCell>
                                    <TableCell>{formatMs(entry.ageMs)}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(entry.mtimeIso)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {cache.entries.length > 200 ? (
                        <div className="px-5 py-3 text-xs text-muted-foreground">
                            Showing 200 of {cache.entries.length} entries.
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
};
