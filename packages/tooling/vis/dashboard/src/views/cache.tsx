import { useQuery } from "@tanstack/react-query";

import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, queryKeys } from "@/lib/api";
import { formatBytes, formatDate, formatMs } from "@/lib/format";

export const CacheView = () => {
    const cacheQuery = useQuery({ queryKey: queryKeys.cache(), queryFn: api.cache });

    if (cacheQuery.isLoading) {
        return <Skeleton label="LOADING CACHE" />;
    }

    if (!cacheQuery.data) {
        return (
            <div className="nd-mono py-16 text-center text-[12px] uppercase tracking-[0.16em] text-faint">
                [NO CACHE DATA]
            </div>
        );
    }

    const cache = cacheQuery.data;

    if (!cache.exists) {
        return (
            <div className="border border-dashed border-border2 bg-panel px-8 py-16">
                <div className="nd-mono mb-3 text-[12px] uppercase tracking-[0.16em] text-muted">
                    [CACHE NOT INITIALIZED]
                </div>
                <p className="text-[14px] text-faint">
                    No cache directory found at{" "}
                    <code className="nd-mono px-1 text-fg">{cache.directory}</code>.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-16">
            {/* HERO: Total size */}
            <section className="grid gap-12 md:grid-cols-[1.4fr_1fr]">
                <StatCard
                    label="[01] · TOTAL CACHE SIZE"
                    variant="hero"
                    value={formatBytes(cache.totalBytes)}
                    sub={cache.directory}
                />
                <div className="flex flex-col">
                    <StatCard variant="stat" label="ENTRIES" value={cache.entries.length.toLocaleString()} />
                    <StatCard
                        variant="stat"
                        label="NEWEST"
                        value={cache.entries[0] ? formatDate(cache.entries[0].mtimeIso) : "—"}
                    />
                    <StatCard
                        variant="stat"
                        label="OLDEST"
                        value={cache.entries.at(-1) ? formatDate(cache.entries.at(-1)!.mtimeIso) : "—"}
                    />
                    {cache.entries.length > 0 ? (
                        <StatCard
                            variant="stat"
                            label="AVG SIZE"
                            value={formatBytes(cache.totalBytes / cache.entries.length)}
                        />
                    ) : null}
                </div>
            </section>

            {/* ENTRIES */}
            <section>
                <div className="mb-6 flex items-baseline gap-4">
                    <span className="nd-mono text-[11px] tracking-[0.16em] text-faint">02</span>
                    <h2 className="nd-mono text-[11px] uppercase tracking-[0.16em] text-muted">ENTRIES</h2>
                    <span aria-hidden className="h-px flex-1 bg-border" />
                    <span className="nd-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                        [{cache.entries.length > 200 ? `200 / ${cache.entries.length}` : cache.entries.length}]
                    </span>
                </div>
                <div className="border border-border bg-panel">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>HASH</TableHead>
                                <TableHead>SIZE</TableHead>
                                <TableHead>AGE</TableHead>
                                <TableHead>MODIFIED</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cache.entries.slice(0, 200).map((entry) => (
                                <TableRow key={entry.hash}>
                                    <TableCell className="nd-mono text-[12px] text-fg">
                                        {entry.hash.slice(0, 16)}
                                        <span className="text-faint">…</span>
                                    </TableCell>
                                    <TableCell className="nd-mono text-[13px]">{formatBytes(entry.sizeBytes)}</TableCell>
                                    <TableCell className="nd-mono text-[13px]">{formatMs(entry.ageMs)}</TableCell>
                                    <TableCell className="nd-mono text-[12px] text-muted">
                                        {formatDate(entry.mtimeIso)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    );
};
