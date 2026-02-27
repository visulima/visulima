/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import cn from "../../utils/cn";

interface ModuleEntry {
    id: string;
    url: string;
    ext: string;
    importers: number;
}

const EXT_COLORS: Record<string, string> = {
    css: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    json: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    ts: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    tsx: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    js: "bg-green-500/15 text-green-400 border-green-500/30",
    jsx: "bg-green-500/15 text-green-400 border-green-500/30",
    vue: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    svg: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const getExt = (url: string): string => {
    const match = url.match(/\.([a-z]+)(?:\?|$)/i);
    return match?.[1]?.toLowerCase() ?? "?";
};

const ExtBadge = ({ ext }: { ext: string }): ComponentChildren => (
    <span class={cn("inline-flex px-1.5 py-0.5 text-[0.6rem] font-mono font-bold uppercase border", EXT_COLORS[ext] ?? "bg-foreground/[0.06] text-muted-foreground border-border")}>
        {ext}
    </span>
);

const ModuleGraphApp = ({ helpers }: AppComponentProps): ComponentChildren => {
    const [modules, setModules] = useState<ModuleEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [importersList, setImportersList] = useState<string[]>([]);
    const searchRef = useRef<HTMLInputElement>(null);

    const load = (): void => {
        setLoading(true);
        setError(null);
        setSelectedId(null);

        (helpers.rpc as any).getModuleGraph().then((rawModules: any[]) => {
            const entries: ModuleEntry[] = rawModules.map((m: any) => ({
                id: m.id ?? m.url ?? "",
                url: m.url ?? m.id ?? "",
                ext: getExt(m.url ?? m.id ?? ""),
                importers: m.importers?.size ?? m.importerCount ?? 0,
            }));
            setModules(entries);
            setLoading(false);
        }).catch((err: Error) => {
            setError(err.message ?? "Failed to load module graph");
            setLoading(false);
        });
    };

    useEffect(() => {
        load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = modules.filter((m) => {
        const q = search.toLowerCase();
        return !q || m.url.toLowerCase().includes(q) || m.ext.includes(q);
    });

    const selectedModule = selectedId ? modules.find((m) => m.id === selectedId) : null;

    const showImporters = (mod: ModuleEntry): void => {
        if (selectedId === mod.id) {
            setSelectedId(null);
            setImportersList([]);
            return;
        }
        setSelectedId(mod.id);
        // importers list from the raw data isn't available after transform — show count
        setImportersList([]);
    };

    if (loading) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
                <div class="flex gap-1.5 items-center" aria-hidden="true">
                    {([0, 160, 320] as const).map((delay) => (
                        <span
                            key={delay}
                            class="size-1.5 bg-primary/50 rounded-full animate-pulse"
                            style={{ animationDelay: `${delay}ms` }}
                        />
                    ))}
                </div>
                <span class="text-[0.75rem] text-muted-foreground">Scanning module graph…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                <p class="text-[0.8rem] text-destructive">{error}</p>
                <button class="px-3 py-1.5 text-[0.75rem] border border-border text-muted-foreground hover:text-foreground cursor-pointer bg-transparent" onClick={load} type="button">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div class="flex flex-col h-full">
            {/* Search + refresh row */}
            <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
                <input
                    ref={searchRef}
                    class={cn(
                        "flex-1 bg-foreground/[0.04] border border-border px-3 py-1.5",
                        "text-[0.8rem] font-mono text-foreground placeholder:text-muted-foreground/50",
                        "focus:outline-none focus:border-primary/50 transition-colors",
                    )}
                    onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                    placeholder="Filter modules…"
                    type="text"
                    value={search}
                />
                <span class="text-[0.7rem] text-muted-foreground shrink-0">{filtered.length} / {modules.length}</span>
                <button
                    class="px-2.5 py-1.5 text-[0.725rem] border border-border text-muted-foreground hover:text-foreground cursor-pointer bg-transparent transition-colors"
                    onClick={load}
                    type="button"
                >
                    Refresh
                </button>
            </div>

            {/* Module list */}
            <div class="flex flex-1 min-h-0 overflow-hidden">
                <div class="flex-1 overflow-auto divide-y divide-border/30">
                    {filtered.length === 0 ? (
                        <div class="flex items-center justify-center p-8 text-[0.8rem] text-muted-foreground">
                            No modules match "{search}"
                        </div>
                    ) : (
                        filtered.map((mod) => (
                            <button
                                key={mod.id}
                                class={cn(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-left border-0 bg-transparent cursor-pointer",
                                    "hover:bg-foreground/[0.04] transition-colors duration-100",
                                    selectedId === mod.id && "bg-primary/[0.06]",
                                )}
                                onClick={() => showImporters(mod)}
                                type="button"
                            >
                                <ExtBadge ext={mod.ext} />
                                <span class="flex-1 text-[0.775rem] font-mono text-foreground/80 truncate min-w-0">{mod.url}</span>
                                {mod.importers > 0 && (
                                    <span class="shrink-0 text-[0.65rem] text-muted-foreground px-1.5 py-0.5 bg-foreground/[0.06] border border-border/50">
                                        {mod.importers}↑
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Detail panel */}
                {selectedModule && (
                    <div class="border-l border-border bg-background w-72 shrink-0 flex flex-col overflow-hidden">
                        <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
                            <span class="text-[0.7rem] font-semibold text-foreground uppercase tracking-wide">Module Info</span>
                            <button
                                aria-label="Close"
                                class="text-muted-foreground hover:text-foreground cursor-pointer border-0 bg-transparent text-xs"
                                onClick={() => { setSelectedId(null); setImportersList([]); }}
                                type="button"
                            >
                                ✕
                            </button>
                        </div>
                        <div class="flex-1 overflow-auto p-4 space-y-3">
                            <div>
                                <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">URL</div>
                                <code class="text-[0.7rem] font-mono text-foreground/80 break-all">{selectedModule.url}</code>
                            </div>
                            <div>
                                <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Type</div>
                                <ExtBadge ext={selectedModule.ext} />
                            </div>
                            <div>
                                <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Importers</div>
                                <span class="text-[0.8rem] font-mono text-foreground">{selectedModule.importers}</span>
                            </div>
                            {importersList.length > 0 && (
                                <div>
                                    <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Imported by</div>
                                    <div class="space-y-1">
                                        {importersList.map((imp) => (
                                            <code key={imp} class="block text-[0.65rem] font-mono text-muted-foreground break-all">{imp}</code>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModuleGraphApp;
