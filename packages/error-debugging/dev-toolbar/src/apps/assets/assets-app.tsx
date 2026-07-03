/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import type { StaticAsset } from "../../types/rpc";
import { Button, Input } from "../../ui";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatSize = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return "–";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Guard against javascript: and data: URIs produced by unusual filenames. */

const safePublicPath = (p: string): string => (p.startsWith("/") && !p.includes(":") ? p : "#");

const TYPE_FILTER_OPTIONS: { label: string; value: StaticAsset["type"] | "all" }[] = [
    { label: "All", value: "all" },
    { label: "Images", value: "image" },
    { label: "Videos", value: "video" },
    { label: "Audio", value: "audio" },
    { label: "Fonts", value: "font" },
    { label: "Text", value: "text" },
    { label: "Other", value: "other" },
];

const TYPE_BADGE: Record<StaticAsset["type"], string> = {
    audio: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    font: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    image: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    other: "bg-foreground/6 text-muted-foreground border-border",
    text: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    video: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const TypeBadge = ({ type }: { type: StaticAsset["type"] }): ComponentChildren => (
    <span class={clsx("inline-flex px-1.5 py-0.5 text-[0.6rem] font-mono font-bold uppercase border", TYPE_BADGE[type])}>{type}</span>
);

const AssetPreview = ({ asset }: { asset: StaticAsset }): ComponentChildren => {
    const src = safePublicPath(asset.publicPath);

    if (src === "#") {
        return undefined;
    }

    if (asset.type === "image") {
        return (
            <div class="flex items-center justify-center bg-foreground/4 border border-border h-32 overflow-hidden">
                <img
                    alt={asset.publicPath}
                    class="max-w-full max-h-full object-contain"
                    onError={(event_) => {
                        (event_.target as HTMLImageElement).style.display = "none";
                    }}
                    src={src}
                />
            </div>
        );
    }

    if (asset.type === "video") {
        return (
            <div class="flex items-center justify-center bg-foreground/4 border border-border h-32 overflow-hidden">
                <video class="max-w-full max-h-full" preload="metadata" src={src} />
            </div>
        );
    }

    if (asset.type === "audio") {
        return (
            <div class="flex items-center justify-center bg-foreground/4 border border-border h-14 px-2">
                <audio class="w-full" controls preload="none" src={src} />
            </div>
        );
    }

    return undefined;
};

// ─── Main component ────────────────────────────────────────────────────────────

const AssetsApp = ({ helpers }: AppComponentProps): ComponentChildren => {
    const [assets, setAssets] = useState<StaticAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | undefined>(undefined);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<StaticAsset["type"] | "all">("all");
    const [selected, setSelected] = useState<StaticAsset | undefined>(undefined);
    const [copied, setCopied] = useState(false);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Clear the copy feedback timer on unmount
    useEffect(
        () => () => {
            clearTimeout(copyTimerRef.current);
        },
        [],
    );

    const load = (): void => {
        setLoading(true);
        setError(undefined);
        setSelected(undefined);

        (helpers.rpc as any)
            .getStaticAssets()

            .then((result: any[]) => {
                setAssets(result as StaticAsset[]);
                setLoading(false);

                return undefined;
            })
            .catch((error_: Error) => {
                setError(error_.message ?? "Failed to load assets");
                setLoading(false);
            });
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = assets.filter((a) => {
        const q = search.toLowerCase();
        const matchesSearch = !q || a.publicPath.toLowerCase().includes(q);
        const matchesType = typeFilter === "all" || a.type === typeFilter;

        return matchesSearch && matchesType;
    });

    const copyPath = (asset: StaticAsset): void => {
        navigator.clipboard
            .writeText(asset.publicPath)
            .then(() => {
                clearTimeout(copyTimerRef.current);
                setCopied(true);
                copyTimerRef.current = setTimeout(setCopied, 1500, false);

                return undefined;
            })
            .catch(() => {
                /* ignore */
            });
    };

    if (loading) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
                <div aria-hidden="true" class="flex gap-1.5 items-center">
                    {([0, 160, 320] as const).map((delay) => (
                        <span class="size-1.5 bg-primary/50 rounded-full animate-pulse" key={delay} style={{ animationDelay: `${delay}ms` }} />
                    ))}
                </div>
                <span class="text-[0.75rem] text-muted-foreground">Scanning assets…</span>
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
            {/* Toolbar row */}
            <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 flex-wrap">
                <Input
                    class="flex-1 min-w-32 bg-foreground/4 font-mono text-[0.8rem] placeholder:text-muted-foreground/50 focus-visible:border-primary/50 border-border"
                    onInput={(event) => {
                        setSearch((event.target as HTMLInputElement).value);
                    }}
                    placeholder="Filter assets…"
                    type="text"
                    value={search}
                />
                <span class="text-[0.7rem] text-muted-foreground shrink-0">
                    {filtered.length} / {assets.length}
                </span>
                <Button onClick={load} size="sm" variant="outline">
                    Refresh
                </Button>
            </div>

            {/* Type filter pills */}
            <div aria-label="Filter by type" class="flex items-center gap-1.5 px-4 py-2 border-b border-border shrink-0 flex-wrap" role="group">
                {TYPE_FILTER_OPTIONS.map((opt) => (
                    <button
                        aria-pressed={typeFilter === opt.value}
                        class={clsx(
                            "px-2.5 py-0.5 text-[0.7rem] font-medium border cursor-pointer transition-colors duration-100",
                            typeFilter === opt.value
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-foreground/4 text-muted-foreground border-border hover:bg-foreground/8 hover:text-foreground",
                        )}
                        key={opt.value}
                        onClick={() => {
                            setTypeFilter(opt.value);
                        }}
                        type="button"
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Content area */}
            <div class="flex flex-1 min-h-0 overflow-hidden">
                {/* Asset list */}
                <div class="flex-1 overflow-auto divide-y divide-border/30" role="list">
                    {filtered.length === 0 ? (
                        <div class="flex items-center justify-center p-8 text-[0.8rem] text-muted-foreground">
                            {assets.length === 0 ? "No assets found in public directory." : "No assets match the current filter."}
                        </div>
                    ) : (
                        filtered.map((asset) => (
                            <button
                                aria-label={asset.publicPath}
                                aria-selected={selected?.publicPath === asset.publicPath}
                                class={clsx(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-left border-0 bg-transparent cursor-pointer",
                                    "hover:bg-foreground/4 transition-colors duration-100",
                                    selected?.publicPath === asset.publicPath && "bg-primary/6",
                                )}
                                key={asset.publicPath}
                                onClick={() => {
                                    setSelected(selected?.publicPath === asset.publicPath ? undefined : asset);
                                }}
                                role="option"
                                type="button"
                            >
                                <TypeBadge type={asset.type} />
                                <span class="flex-1 text-[0.775rem] font-mono text-foreground/80 truncate min-w-0">{asset.publicPath}</span>
                                <span class="shrink-0 text-[0.65rem] text-muted-foreground">{formatSize(asset.size)}</span>
                            </button>
                        ))
                    )}
                </div>

                {/* Detail panel */}
                {selected && (
                    <div class="border-l border-border bg-background w-72 shrink-0 flex flex-col overflow-hidden">
                        <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
                            <span class="text-[0.7rem] font-semibold text-foreground uppercase tracking-wide">Asset Info</span>
                            <Button
                                aria-label="Close"
                                class="h-6 w-6 text-xs"
                                onClick={() => {
                                    setSelected(undefined);
                                }}
                                size="icon"
                                variant="ghost"
                            >
                                ✕
                            </Button>
                        </div>
                        <div class="flex-1 overflow-auto p-4 space-y-4">
                            {/* Preview */}
                            <AssetPreview asset={selected} />

                            {/* Metadata */}
                            <div>
                                <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Path</div>
                                <code class="text-[0.7rem] font-mono text-foreground/80 break-all">{selected.publicPath}</code>
                            </div>
                            <div>
                                <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Type</div>
                                <TypeBadge type={selected.type} />
                            </div>
                            <div>
                                <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Size</div>
                                <span class="text-[0.8rem] font-mono text-foreground">{formatSize(selected.size)}</span>
                            </div>
                            <div>
                                <div class="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Last Modified</div>
                                <span class="text-[0.75rem] text-foreground/80">{new Date(selected.mtime).toLocaleString()}</span>
                            </div>

                            {/* Actions */}
                            <div class="flex flex-col gap-2 pt-1">
                                <Button
                                    class="w-full text-[0.75rem]"
                                    onClick={() => {
                                        copyPath(selected);
                                    }}
                                    size="sm"
                                    variant="outline"
                                >
                                    {copied ? "Copied!" : "Copy URL"}
                                </Button>
                                <a
                                    class={clsx(
                                        "w-full text-[0.75rem] inline-flex items-center justify-center",
                                        "px-3 py-1.5 border border-border bg-transparent",
                                        "text-foreground hover:bg-foreground/6 transition-colors duration-100",
                                    )}
                                    href={safePublicPath(selected.publicPath)}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                >
                                    Open in browser
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetsApp;
