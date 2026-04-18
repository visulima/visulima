import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Sidebar, type View } from "@/components/sidebar";
import { useLiveEvents } from "@/hooks/use-live-events";
import { api, queryKeys } from "@/lib/api";
import { CacheView } from "@/views/cache";
import { Overview } from "@/views/overview";
import { RunDetail } from "@/views/run-detail";
import { RunsView } from "@/views/runs";

export const App = () => {
    const [view, setView] = useState<View>("overview");
    const [selectedRun, setSelectedRun] = useState<string | null>(null);

    const environmentQuery = useQuery({ queryKey: queryKeys.environment(), queryFn: api.environment });
    const live = useLiveEvents();

    const openRun = (id: string) => {
        setSelectedRun(id);
        setView("runs");
    };

    return (
        <div className="flex h-screen bg-background">
            <Sidebar
                view={view}
                onChange={(next) => {
                    setSelectedRun(null);
                    setView(next);
                }}
                workspaceRoot={environmentQuery.data?.workspaceRoot}
                live={live}
            />
            <main className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-6xl px-8 py-6">
                    <header className="mb-6 flex items-baseline justify-between">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {view === "overview"
                                ? "Overview"
                                : view === "runs"
                                    ? selectedRun
                                        ? "Run detail"
                                        : "Recent runs"
                                    : "Cache"}
                        </h1>
                        {environmentQuery.data ? (
                            <span className="text-xs text-muted-foreground">
                                Node {environmentQuery.data.node} · {environmentQuery.data.platform}/
                                {environmentQuery.data.arch}
                            </span>
                        ) : null}
                    </header>

                    {view === "overview" ? <Overview /> : null}
                    {view === "runs" && selectedRun ? (
                        <RunDetail runId={selectedRun} onBack={() => setSelectedRun(null)} />
                    ) : null}
                    {view === "runs" && !selectedRun ? <RunsView onSelect={openRun} /> : null}
                    {view === "cache" ? <CacheView /> : null}
                </div>
            </main>
        </div>
    );
};
