/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import { Button, Input } from "../../ui";

interface ModuleEntry {
    ext: string;
    id: string;
    importers: number;
    importerUrls: string[];
    url: string;
}

const EXT_COLORS: Record<string, string> = {
    css: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    js: "bg-green-500/15 text-green-400 border-green-500/30",
    json: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    jsx: "bg-green-500/15 text-green-400 border-green-500/30",
    svg: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    ts: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    tsx: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    vue: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const EXT_REGEX = /\.([a-z]+)(?:\?|$)/i;

const getExtension = (url: string): string => {
    const match = url.match(EXT_REGEX);

    return match?.[1]?.toLowerCase() ?? "?";
};

const ExtensionBadge = ({ ext }: { ext: string }): ComponentChildren => (
    <span
        class={clsx(
            "inline-flex px-1.5 py-0.5 text-[0.6rem] font-mono font-bold uppercase border",
            EXT_COLORS[ext] ?? "bg-foreground/6 text-muted-foreground border-border",
        )}
    >
        {ext}
    </span>
);

const ModuleGraphApp = ({ helpers }: AppComponentProps): ComponentChildren => {
    const [modules, setModules] = useState<ModuleEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | undefined>(undefined);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
    const [importersList, setImportersList] = useState<string[]>([]);
    const searchRef = useRef<HTMLInputElement>(null);

    const load = (): void => {
        setLoading(true);
        setError(undefined);
        setSelectedId(undefined);

        (helpers.rpc as any)
            .getModuleGraph()

            .then((rawModules: any[]) => {
                const entries: ModuleEntry[] = rawModules.map((m: any) => {
                    return {
                        ext: getExtension(m.url ?? m.id ?? ""),
                        id: m.id ?? m.url ?? "",
                        importers: m.importerCount ?? 0,
                        importerUrls: Array.isArray(m.importerUrls) ? m.importerUrls : [],
                        url: m.url ?? m.id ?? "",
                    };
                });

                setModules(entries);
                setLoading(false);

                return undefined;
            })
            .catch((error_: Error) => {
                setError(error_.message ?? "Failed to load module graph");
                setLoading(false);
            });
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = modules.filter((m) => {
        const q = search.toLowerCase();

        return !q || m.url.toLowerCase().includes(q) || m.ext.includes(q);
    });

    const selectedModule = selectedId ? modules.find((m) => m.id === selectedId) : undefined;

    const showImporters = (module_: ModuleEntry): void => {
        if (selectedId === module_.id) {
            setSelectedId(undefined);
            setImportersList([]);

            return;
        }

        setSelectedId(module_.id);
        setImportersList(module_.importerUrls);
    };

    if (loading) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
                <div aria-hidden="true" class="flex gap-1.5 items-center">
                    {([0, 160, 320] as const).map((delay) => (
                        <span class="size-1.5 bg-primary/50 rounded-full animate-pulse" key={delay} style={{ animationDelay: `${delay}ms` }} />
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
                <Button onClick={load} size="sm" variant="outline">
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div class="flex flex-col h-full">
            {/* Search + refresh row */}
            <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
                <Input
                    class="flex-1 bg-foreground/4 font-mono text-[0.8rem] placeholder:text-muted-foreground/50 focus-visible:border-primary/50 border-border"
                    onInput={(event) => {
                        setSearch((event.target as HTMLInputElement).value);
                    }}
                    placeholder="Filter modules…"
                    ref={searchRef}
                    type="text"
                    value={search}
                />
                <span class="text-[0.7rem] text-muted-foreground shrink-0">
                    {filtered.length} / {modules.length}
                </span>
                <Button onClick={load} size="sm" variant="outline">
                    Refresh
                </Button>
            </div>

            {/* Module list */}
            <div class="flex flex-1 min-h-0 overflow-hidden">
                <div class="flex-1 overflow-auto divide-y divide-border/30">
                    {filtered.length === 0 ? (
                        <div class="flex items-center justify-center p-8 text-[0.8rem] text-muted-foreground">No modules match "{search}"</div>
                    ) : (
                        filtered.map((module_) => (
                            <button
                                class={clsx(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-left border-0 bg-transparent cursor-pointer",
                                    "hover:bg-foreground/4 transition-colors duration-100",
                                    selectedId === module_.id && "bg-primary/6",
                                )}
                                key={module_.id}
                                onClick={() => {
                                    showImporters(module_);
                                }}
                                type="button"
                            >
                                <ExtensionBadge ext={module_.ext} />
                                <span class="flex-1 text-[0.775rem] font-mono text-foreground/80 truncate min-w-0">{module_.url}</span>
                                {module_.importers > 0 && (
                                    <span class="shrink-0 text-[0.65rem] text-muted-foreground px-1.5 py-0.5 bg-foreground/6 border border-border/50">
                                        {module_.importers}↑
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
                            <Button
                                aria-label="Close"
                                class="h-6 w-6 text-xs"
                                onClick={() => {
                                    setSelectedId(undefined);
                                    setImportersList([]);
                                }}
                                size="icon"
                                variant="ghost"
                            >
                                ✕
                            </Button>
                        </div>
                        <div class="flex-1 overflow-auto p-4 space-y-3">
                            <div>
                                <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">URL</div>
                                <code class="text-[0.7rem] font-mono text-foreground/80 break-all">{selectedModule.url}</code>
                            </div>
                            <div>
                                <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Type</div>
                                <ExtensionBadge ext={selectedModule.ext} />
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
                                            <code class="block text-[0.65rem] font-mono text-muted-foreground break-all" key={imp}>
                                                {imp}
                                            </code>
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
