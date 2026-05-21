import { useQuery } from "@tanstack/react-query";

import type { HashDiffEntry } from "@/lib/api";
import { api, queryKeys } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CacheMissAccordionProps {
    runId: string;
    taskId: string;
}

const changeSymbol = (change: HashDiffEntry["change"]) => {
    switch (change) {
        case "added": {
            return { color: "text-success", symbol: "+" };
        }
        case "removed": {
            return { color: "text-accent", symbol: "-" };
        }
        default: {
            return { color: "text-warning", symbol: "~" };
        }
    }
};

const kindLabel: Record<HashDiffEntry["kind"], string> = {
    command: "COMMAND",
    implicitDeps: "DEPENDENCY",
    nodes: "INPUT FILE",
    runtime: "RUNTIME VALUE",
};

export const CacheMissAccordion = ({ runId, taskId }: CacheMissAccordionProps) => {
    const diffQuery = useQuery({
        queryFn: () => api.diff(runId, taskId),
        queryKey: queryKeys.diff(runId, taskId),
    });

    if (diffQuery.isLoading) {
        return (
            <div className="nd-mono px-6 py-4 text-[11px] uppercase tracking-[0.16em] text-faint">
                [ANALYZING DIFF…]
            </div>
        );
    }

    if (!diffQuery.data) {
        return (
            <div className="nd-mono px-6 py-4 text-[11px] uppercase tracking-[0.16em] text-accent">
                [ERROR: FAILED TO LOAD DIFF]
            </div>
        );
    }

    const { currentHash, entries, previousHash, previousRunStartTime, reason } = diffQuery.data;

    return (
        <div className="flex flex-col gap-4 px-6 py-5">
            <div className="border-l-2 border-accent pl-4">
                <div className="nd-label mb-1">REASON</div>
                <div className="text-[14px] text-fg">{reason}</div>
                <div className="nd-mono mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">
                    {previousHash
                        ? (
                        <>
                            PREV
{" "}
{previousHash.slice(0, 12)}
                            {" · "}
                            {formatDate(previousRunStartTime)}
                        </>
                        )
                        : (
                            "NO PRIOR EXECUTION FOUND"
                        )}
                    {currentHash
                        ? (
                        <>
                            {" · CURR "}
                            {currentHash.slice(0, 12)}
                        </>
                        )
                        : null}
                </div>
            </div>

            {entries.length === 0
                ? (
                <div className="border border-dashed border-border2 px-4 py-3">
                    <div className="nd-mono mb-1 text-[11px] uppercase tracking-[0.16em] text-muted">
                        [NO INPUT DIFFERENCES DETECTED]
                    </div>
                    <p className="text-[12px] text-faint">
                        The previous cache entry may have been evicted by
{" "}
                        <code className="nd-mono px-1 text-fg">vis cache prune</code>
{" "}
or the size limit.
                    </p>
                </div>
                )
                : (
                <div className="border border-border">
                    {entries.map((entry, index) => {
                        const { color, symbol } = changeSymbol(entry.change);

                        return (
                            <div
                                className="flex flex-col gap-1.5 border-b border-border px-4 py-3 last:border-b-0"
                                key={`${entry.kind}:${entry.key}:${String(index)}`}
                            >
                                <div className="nd-mono flex items-center gap-3 text-[10px] uppercase tracking-[0.1em]">
                                    <span className={cn("inline-block w-3 text-center text-[13px]", color)}>{symbol}</span>
                                    <span className="text-faint">{kindLabel[entry.kind]}</span>
                                    <span className="text-fg">{entry.key}</span>
                                </div>
                                {entry.previous === undefined
                                    ? null
                                    : (
                                    <div className="nd-mono flex gap-3 text-[11px] text-accent">
                                        <span className="select-none text-faint">-</span>
                                        <span className="break-all">{entry.previous}</span>
                                    </div>
                                    )}
                                {entry.current === undefined
                                    ? null
                                    : (
                                    <div className="nd-mono flex gap-3 text-[11px] text-success">
                                        <span className="select-none text-faint">+</span>
                                        <span className="break-all">{entry.current}</span>
                                    </div>
                                    )}
                            </div>
                        );
                    })}
                </div>
                )}
        </div>
    );
};
