import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MinusCircle, PlusCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, queryKeys, type HashDiffEntry } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CacheMissDiffProps {
    runId: string;
    taskId: string;
    onBack: () => void;
}

const changeIcon = (change: HashDiffEntry["change"]) => {
    switch (change) {
        case "added": {
            return <PlusCircle className="h-3.5 w-3.5 text-emerald-400" />;
        }

        case "removed": {
            return <MinusCircle className="h-3.5 w-3.5 text-red-400" />;
        }

        default: {
            return <RefreshCw className="h-3.5 w-3.5 text-amber-400" />;
        }
    }
};

const kindLabel: Record<HashDiffEntry["kind"], string> = {
    command: "Command",
    nodes: "Input file",
    implicitDeps: "Dependency",
    runtime: "Runtime value",
};

export const CacheMissDiff = ({ runId, taskId, onBack }: CacheMissDiffProps) => {
    const diffQuery = useQuery({
        queryKey: queryKeys.diff(runId, taskId),
        queryFn: () => api.diff(runId, taskId),
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <div>
                    <div className="text-sm text-muted-foreground">Cache miss analysis</div>
                    <div className="font-mono text-sm">{taskId}</div>
                </div>
            </div>

            {diffQuery.isLoading ? (
                <Skeleton className="h-48" />
            ) : diffQuery.data ? (
                <Card>
                    <CardHeader>
                        <CardTitle>{diffQuery.data.reason}</CardTitle>
                        <div className="text-xs text-muted-foreground">
                            {diffQuery.data.previousHash ? (
                                <>
                                    Compared against hash{" "}
                                    <code className="font-mono">{diffQuery.data.previousHash.slice(0, 12)}</code> from{" "}
                                    {formatDate(diffQuery.data.previousRunStartTime)}
                                </>
                            ) : (
                                "No prior cached execution of this task was found."
                            )}
                            {diffQuery.data.currentHash ? (
                                <>
                                    {" · Current hash "}
                                    <code className="font-mono">{diffQuery.data.currentHash.slice(0, 12)}</code>
                                </>
                            ) : null}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {diffQuery.data.entries.length === 0 ? (
                            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                No input differences detected. The previous cache entry may have been evicted by
                                <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">vis cache prune</code>
                                or the size limit.
                            </div>
                        ) : (
                            <div className="flex flex-col divide-y rounded-md border bg-background">
                                {diffQuery.data.entries.map((entry, index) => (
                                    <div key={`${entry.kind}:${entry.key}:${String(index)}`} className="flex flex-col gap-1 p-3 font-mono text-xs">
                                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                                            {changeIcon(entry.change)}
                                            <span>{kindLabel[entry.kind]}</span>
                                            <span className="text-foreground">{entry.key}</span>
                                        </div>
                                        {entry.previous !== undefined ? (
                                            <div className={cn("flex gap-2", "text-red-300")}>
                                                <span className="opacity-60">-</span>
                                                <span className="break-all">{entry.previous}</span>
                                            </div>
                                        ) : null}
                                        {entry.current !== undefined ? (
                                            <div className={cn("flex gap-2", "text-emerald-300")}>
                                                <span className="opacity-60">+</span>
                                                <span className="break-all">{entry.current}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-6 text-sm text-muted-foreground">Failed to load diff.</CardContent>
                </Card>
            )}
        </div>
    );
};
