import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Footer } from "@/components/footer";
import { Masthead, type View } from "@/components/masthead";
import { useLiveEvents } from "@/hooks/use-live-events";
import { api, queryKeys } from "@/lib/api";
import { CacheView } from "@/views/cache";
import { Overview } from "@/views/overview";
import { RunDetail } from "@/views/run-detail";
import { RunsView } from "@/views/runs";

const titles: Record<View, string> = {
    overview: "OVERVIEW",
    runs: "RUNS",
    cache: "CACHE",
};

export const App = () => {
    const [view, setView] = useState<View>("overview");
    const [selectedRun, setSelectedRun] = useState<string | null>(null);

    const environmentQuery = useQuery({ queryKey: queryKeys.environment(), queryFn: api.environment });
    const live = useLiveEvents();

    const openRun = (id: string) => {
        setSelectedRun(id);
        setView("runs");
    };

    const heading = view === "runs" && selectedRun ? "RUN DETAIL" : titles[view];

    return (
        <div className="flex min-h-screen flex-col bg-bg text-fg">
            <Masthead
                view={view}
                onChange={(next) => {
                    setSelectedRun(null);
                    setView(next);
                }}
            />

            <main className="flex-1">
                <div className="w-full px-12 pt-12 pb-12">
                    <header className="mb-10 border-b border-border pb-6">
                        <h1 className="nd-mono text-[44px] uppercase leading-[0.9] tracking-[-0.02em] text-fg">
                            {heading}
                        </h1>
                    </header>

                    <div className="nd-fade-in" key={`${view}:${selectedRun ?? ""}`}>
                        {view === "overview" ? <Overview /> : null}
                        {view === "runs" && selectedRun ? (
                            <RunDetail runId={selectedRun} onBack={() => setSelectedRun(null)} />
                        ) : null}
                        {view === "runs" && !selectedRun ? <RunsView onSelect={openRun} /> : null}
                        {view === "cache" ? <CacheView /> : null}
                    </div>
                </div>
            </main>

            <Footer
                workspaceRoot={environmentQuery.data?.workspaceRoot}
                node={environmentQuery.data?.node}
                platform={environmentQuery.data?.platform}
                arch={environmentQuery.data?.arch}
                live={live}
            />
        </div>
    );
};
