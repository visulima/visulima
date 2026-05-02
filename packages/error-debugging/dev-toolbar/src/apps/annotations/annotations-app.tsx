/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import type { Annotation, AnnotationIntent, AnnotationSeverity, AnnotationStatus } from "../../types/annotations";
import type { AppComponentProps } from "../../types/app";
import { Button, Textarea } from "../../ui";
import { annotationsToMarkdown } from "../inspector/element-utils";
import type { AnnotationSettings } from "../inspector/annotation-settings";
import { loadSettings, MARKER_COLORS, saveSettings } from "../inspector/annotation-settings";
import { buildSessionZip, type ExportSessionFile, triggerDownload } from "./zip-bundle";

// ─── Constants ───────────────────────────────────────────────────────────────

const INTENT_LABEL: Record<AnnotationIntent, string> = {
    approve: "Approve",
    change: "Change",
    fix: "Fix",
    question: "Question",
};

const INTENT_COLOR: Record<AnnotationIntent, string> = {
    approve: "bg-green-500/20 text-green-400 border-green-500/30",
    change: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    fix: "bg-destructive/20 text-destructive border-destructive/30",
    question: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const SEVERITY_LABEL: Record<AnnotationSeverity, string> = {
    blocking: "Blocking",
    important: "Important",
    suggestion: "Suggestion",
};

const SEVERITY_COLOR: Record<AnnotationSeverity, string> = {
    blocking: "text-destructive",
    important: "text-warning-foreground",
    suggestion: "text-muted-foreground",
};

const STATUS_LABEL: Record<AnnotationStatus, string> = {
    acknowledged: "Acknowledged",
    dismissed: "Dismissed",
    pending: "Pending",
    resolved: "Resolved",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusFilters = ({
    active,
    counts,
    onFilter,
}: {
    active: AnnotationStatus | "all";
    counts: Record<AnnotationStatus | "all", number>;
    onFilter: (s: AnnotationStatus | "all") => void;
}): ComponentChildren => (
    <div class="flex gap-1.5">
        {(["all", "pending", "acknowledged", "resolved", "dismissed"] as const).map((s) => (
            <button
                class={clsx(
                    "px-2.5 py-1 text-[0.65rem] font-medium border cursor-pointer transition-colors",
                    active === s ? "bg-primary/10 border-primary/30 text-primary" : "bg-foreground/3 border-border text-muted-foreground hover:bg-foreground/6",
                )}
                key={s}
                onClick={() => onFilter(s)}
                type="button"
            >
                {s === "all" ? "All" : STATUS_LABEL[s]} ({counts[s]})
            </button>
        ))}
    </div>
);

const AnnotationCard = ({
    annotation,
    isSelected,
    onClick,
    onDelete,
    onDismiss,
    onResolve,
}: {
    annotation: Annotation;
    isSelected: boolean;
    onClick: () => void;
    onDelete: () => void;
    onDismiss: () => void;
    onResolve: () => void;
}): ComponentChildren => (
    <div
        class={clsx("p-3 border cursor-pointer transition-colors", isSelected ? "bg-foreground/6 border-primary/30" : "border-border hover:bg-foreground/3")}
        onClick={onClick}
    >
        {/* Header */}
        <div class="flex items-start gap-2 mb-1.5">
            <span class={clsx("text-[0.6rem] font-bold uppercase px-1.5 py-0.5 border shrink-0", INTENT_COLOR[annotation.intent])}>
                {INTENT_LABEL[annotation.intent]}
            </span>
            <span class={clsx("text-[0.6rem] font-semibold uppercase tracking-wide shrink-0", SEVERITY_COLOR[annotation.severity])}>
                {SEVERITY_LABEL[annotation.severity]}
            </span>
            <span class="flex-1" />
            {annotation.resolvedBy && <span class="text-[0.58rem] text-muted-foreground/60">by {annotation.resolvedBy}</span>}
            <span class="text-[0.58rem] text-muted-foreground/60">{STATUS_LABEL[annotation.status]}</span>
        </div>

        {/* Comment */}
        <p class="text-[0.7rem] text-foreground leading-relaxed mb-1.5 line-clamp-2">{annotation.comment}</p>

        {/* Element info */}
        <div class="flex items-center gap-2 mb-1.5">
            <code class="text-[0.62rem] text-foreground/60 font-mono bg-foreground/5 px-1.5 py-0.5 truncate">
                {annotation.elementTag}
                {annotation.elementPath ? ` \u00B7 ${annotation.elementPath}` : ""}
            </code>
        </div>

        {/* Source */}
        {annotation.source && (
            <div class="mb-1.5">
                <code class="text-[0.6rem] text-primary/60 font-mono">{annotation.source}</code>
            </div>
        )}

        {/* URL + thread */}
        <div class="text-[0.58rem] text-muted-foreground/50 truncate mb-2">{annotation.url}</div>
        {annotation.thread && annotation.thread.length > 0 && (
            <div class="text-[0.6rem] text-muted-foreground/60 mb-2">
                {annotation.thread.length} message{annotation.thread.length === 1 ? "" : "s"} in thread
            </div>
        )}

        {/* Actions */}
        {annotation.status === "pending" && (
            <div class="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button class="h-auto py-0.5 px-2 text-[0.6rem]" onClick={onResolve} size="sm" variant="outline">
                    Resolve
                </Button>
                <Button class="h-auto py-0.5 px-2 text-[0.6rem]" onClick={onDismiss} size="sm" variant="outline">
                    Dismiss
                </Button>
                <span class="flex-1" />
                <Button class="h-auto py-0.5 px-2 text-[0.6rem] text-destructive hover:text-destructive" onClick={onDelete} size="sm" variant="ghost">
                    Delete
                </Button>
            </div>
        )}
    </div>
);

const AnnotationDetail = ({
    annotation,
    helpers,
    onBack,
    onRefresh,
}: {
    annotation: Annotation;
    helpers: AppComponentProps["helpers"];
    onBack: () => void;
    onRefresh: () => void;
}): ComponentChildren => {
    const [message, setMessage] = useState("");

    const handleSend = useCallback(async () => {
        const text = message.trim();

        if (!text) {
            return;
        }

        await helpers.rpc.updateAnnotation?.(annotation.id, {
            threadMessage: { content: text, role: "human", timestamp: new Date().toISOString() },
        });
        setMessage("");
        onRefresh();
    }, [annotation.id, helpers, message, onRefresh]);

    return (
        <div class="p-4 space-y-3">
            <Button class="h-auto py-0.5 px-2 text-[0.65rem]" onClick={onBack} size="sm" variant="ghost">
                &larr; Back
            </Button>

            {/* Header */}
            <div class="flex items-center gap-2 flex-wrap">
                <span class={clsx("text-[0.65rem] font-bold uppercase px-2 py-0.5 border", INTENT_COLOR[annotation.intent])}>
                    {INTENT_LABEL[annotation.intent]}
                </span>
                <span class={clsx("text-[0.65rem] font-semibold", SEVERITY_COLOR[annotation.severity])}>{SEVERITY_LABEL[annotation.severity]}</span>
                <span class="text-[0.6rem] text-muted-foreground ml-auto">{STATUS_LABEL[annotation.status]}</span>
            </div>

            {/* Comment */}
            <div class="text-[0.75rem] text-foreground leading-relaxed border border-border p-3">{annotation.comment}</div>

            {/* Meta */}
            <div class="space-y-1 text-[0.65rem]">
                <div class="flex gap-2">
                    <span class="text-muted-foreground w-16 shrink-0">Element</span>
                    <code class="text-foreground/70 font-mono">
                        {annotation.elementTag}
                        {annotation.cssClasses ? ` .${annotation.cssClasses}` : ""}
                    </code>
                </div>
                {annotation.source && (
                    <div class="flex gap-2">
                        <span class="text-muted-foreground w-16 shrink-0">Source</span>
                        <code class="text-primary/70 font-mono">{annotation.source}</code>
                    </div>
                )}
                <div class="flex gap-2">
                    <span class="text-muted-foreground w-16 shrink-0">URL</span>
                    <span class="text-foreground/60 truncate">{annotation.url}</span>
                </div>
                <div class="flex gap-2">
                    <span class="text-muted-foreground w-16 shrink-0">Created</span>
                    <span class="text-foreground/60">{new Date(annotation.createdAt).toLocaleString()}</span>
                </div>
            </div>

            {/* Thread */}
            <div>
                <div class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                    <span aria-hidden="true" class="text-primary/50">
                        {"// "}
                    </span>
                    Thread ({annotation.thread?.length ?? 0})
                </div>

                {annotation.thread && annotation.thread.length > 0 && (
                    <div class="space-y-2 mb-3">
                        {annotation.thread.map((message_) => (
                            <div class="border border-border p-2" key={`${message_.role}-${message_.timestamp}`}>
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-[0.62rem] font-semibold text-primary/70">{message_.role}</span>
                                    <span class="text-[0.55rem] text-muted-foreground/50">{new Date(message_.timestamp).toLocaleString()}</span>
                                </div>
                                <p class="text-[0.68rem] text-foreground/80 leading-relaxed whitespace-pre-wrap">{message_.content}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div class="space-y-2">
                    <Textarea
                        class="text-[0.7rem] min-h-[60px]"
                        onChange={(e: Event) => setMessage((e.target as HTMLTextAreaElement).value)}
                        placeholder="Add a message to the thread..."
                        value={message}
                    />
                    <Button class="text-[0.65rem]" disabled={!message.trim()} onClick={handleSend} size="sm" variant="outline">
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
};

// ─── Main component ──────────────────────────────────────────────────────────

// ─── Settings Panel ──────────────────────────────────────────────────────────

const AnnotationSettingsPanel = ({ onChange, settings }: { onChange: (s: AnnotationSettings) => void; settings: AnnotationSettings }): ComponentChildren => {
    const update = (partial: Partial<AnnotationSettings>): void => {
        const next = { ...settings, ...partial };

        saveSettings(next);
        onChange(next);
    };

    return (
        <div class="space-y-3 p-4 border-t border-border">
            <div class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <span aria-hidden="true" class="text-primary/50">
                    {"// "}
                </span>
                Settings
            </div>

            {/* Output Detail Level */}
            <label class="flex items-center gap-2 text-[0.7rem] text-foreground">
                <span class="text-muted-foreground w-24 shrink-0">Output Detail</span>
                <select
                    class="flex-1 bg-card border border-border text-foreground text-[0.65rem] px-1.5 py-1 cursor-pointer"
                    onChange={(e) => update({ outputDetail: (e.target as HTMLSelectElement).value as AnnotationSettings["outputDetail"] })}
                    style="color-scheme: dark"
                    value={settings.outputDetail}
                >
                    <option value="compact">Compact</option>
                    <option value="standard">Standard</option>
                    <option value="detailed">Detailed</option>
                    <option value="forensic">Forensic</option>
                </select>
            </label>

            {/* Marker Color */}
            <div class="flex items-center gap-2 text-[0.7rem]">
                <span class="text-muted-foreground w-24 shrink-0">Marker Color</span>
                <div class="flex gap-1.5">
                    {MARKER_COLORS.map((mc) => (
                        <button
                            class={clsx(
                                "w-5 h-5 rounded-full border-2 cursor-pointer p-0 transition-all",
                                mc.name === settings.markerColorName ? "border-foreground scale-110" : "border-transparent hover:scale-110",
                            )}
                            key={mc.name}
                            onClick={() => update({ markerColorName: mc.name })}
                            style={{ background: mc.bg }}
                            title={mc.label}
                            type="button"
                        />
                    ))}
                </div>
            </div>

            {/* Marker Click Behavior */}
            <label class="flex items-center gap-2 text-[0.7rem] text-foreground">
                <span class="text-muted-foreground w-24 shrink-0">Marker Click</span>
                <select
                    class="flex-1 bg-card border border-border text-foreground text-[0.65rem] px-1.5 py-1 cursor-pointer"
                    onChange={(e) => update({ markerClickBehavior: (e.target as HTMLSelectElement).value as AnnotationSettings["markerClickBehavior"] })}
                    style="color-scheme: dark"
                    value={settings.markerClickBehavior}
                >
                    <option value="detail">Show Detail</option>
                    <option value="edit">Edit</option>
                    <option value="delete">Delete</option>
                </select>
            </label>

            {/* Block Interactions */}
            <label class="flex items-center gap-2 text-[0.7rem] text-foreground cursor-pointer">
                <input
                    checked={settings.blockInteractions}
                    class="cursor-pointer"
                    onChange={(e) => update({ blockInteractions: (e.target as HTMLInputElement).checked })}
                    type="checkbox"
                />
                <span>Block page interactions while inspecting</span>
            </label>
        </div>
    );
};

// ─── Main component ──────────────────────────────────────────────────────────

const AnnotationsApp = ({ helpers }: AppComponentProps): ComponentChildren => {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [filterStatus, setFilterStatus] = useState<AnnotationStatus | "all">("pending");
    const [filterIntent, setFilterIntent] = useState<AnnotationIntent | "all">("all");
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<AnnotationSettings>(() => loadSettings());

    const load = useCallback(async () => {
        setLoading(true);
        setError(undefined);

        try {
            const data = await helpers.rpc.getAnnotations?.();

            setAnnotations((data as Annotation[] | undefined) ?? []);
        } catch (error_) {
            setError(error_ instanceof Error ? error_.message : String(error_));
        } finally {
            setLoading(false);
        }
    }, [helpers]);

    useEffect(() => {
        load().catch(() => {});
    }, [load]);

    const filtered = annotations.filter((a) => {
        if (filterStatus !== "all" && a.status !== filterStatus) {
            return false;
        }

        if (filterIntent !== "all" && a.intent !== filterIntent) {
            return false;
        }

        return true;
    });

    const countByStatus = (s: AnnotationStatus): number => annotations.filter((a) => a.status === s).length;
    const counts: Record<AnnotationStatus | "all", number> = {
        acknowledged: countByStatus("acknowledged"),
        all: annotations.length,
        dismissed: countByStatus("dismissed"),
        pending: countByStatus("pending"),
        resolved: countByStatus("resolved"),
    };

    const selected = selectedId ? annotations.find((a) => a.id === selectedId) : undefined;

    const handleAction = useCallback(
        async (id: string, action: "resolve" | "dismiss" | "delete") => {
            try {
                await (action === "delete"
                    ? helpers.rpc.deleteAnnotation?.(id)
                    : helpers.rpc.updateAnnotation?.(id, { status: action === "resolve" ? "resolved" : "dismissed" }));

                await load();
            } catch (error_) {
                console.error(`[annotations] ${action} failed for ${id}:`, error_);
                setError(error_ instanceof Error ? error_.message : `Failed to ${action} annotation`);
            }
        },
        [helpers, load],
    );

    const handleExport = useCallback(async () => {
        try {
            const markdown = annotationsToMarkdown(annotations);
            const result = await (helpers.rpc as unknown as {
                exportSession: (md: string) => Promise<{ files: ExportSessionFile[]; generatedAt: string }>;
            }).exportSession(markdown);
            const blob = buildSessionZip(result.files);
            const stamp = result.generatedAt.replace(/[:.]/g, "-");

            triggerDownload(blob, `dev-toolbar-session-${stamp}.zip`);
        } catch (error_) {
            console.error("[annotations] export failed:", error_);
            setError(error_ instanceof Error ? error_.message : "Export failed");
        }
    }, [annotations, helpers]);

    // ── Detail view ──
    if (selected) {
        return <AnnotationDetail annotation={selected} helpers={helpers} onBack={() => setSelectedId(undefined)} onRefresh={() => load().catch(() => {})} />;
    }

    // ── List view ──
    return (
        <div class="flex flex-col h-full">
            {/* Toolbar */}
            <div class="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-foreground/2 flex-wrap">
                <Button disabled={loading} onClick={() => load().catch(() => {})} size="sm" variant="outline">
                    {loading ? "Loading\u2026" : "Refresh"}
                </Button>
                <Button
                    class={clsx("text-[0.65rem]", showSettings && "bg-primary/10 text-primary")}
                    onClick={() => setShowSettings(!showSettings)}
                    size="sm"
                    variant="ghost"
                >
                    Settings
                </Button>
                <Button
                    class="text-[0.65rem]"
                    disabled={annotations.length === 0}
                    onClick={() => handleExport().catch(() => {})}
                    size="sm"
                    title="Download annotations.json + markdown export + every attachment as a zip bundle."
                    variant="ghost"
                >
                    Export session
                </Button>
                <span class="flex-1" />
                <select
                    class="bg-card border border-border text-foreground text-[0.65rem] px-1.5 py-1 cursor-pointer"
                    onChange={(e) => setFilterIntent((e.target as HTMLSelectElement).value as AnnotationIntent | "all")}
                    style="color-scheme: dark"
                    value={filterIntent}
                >
                    <option value="all">All intents</option>
                    <option value="fix">Fix</option>
                    <option value="change">Change</option>
                    <option value="question">Question</option>
                    <option value="approve">Approve</option>
                </select>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-y-auto devtools-content-scroll">
                {error && <div class="p-3 text-[0.7rem] text-destructive bg-destructive/10 border-b border-destructive/20">{error}</div>}

                <div class="p-4 space-y-3">
                    <StatusFilters active={filterStatus} counts={counts} onFilter={setFilterStatus} />

                    {filtered.length === 0 ? (
                        <div class="p-6 text-center border border-border">
                            <p class="text-[0.8125rem] font-medium text-foreground/70">
                                {annotations.length === 0 ? "No annotations yet" : "No annotations match filters"}
                            </p>
                            <p class="mt-1 text-[0.7rem] text-muted-foreground">
                                {annotations.length === 0
                                    ? "Use the Inspector to click an element and select \"Annotate\"."
                                    : "Try changing the status or intent filter."}
                            </p>
                        </div>
                    ) : (
                        <div class="space-y-2">
                            {filtered.map((a) => (
                                <AnnotationCard
                                    annotation={a}
                                    isSelected={selectedId === a.id}
                                    key={a.id}
                                    onClick={() => setSelectedId(a.id)}
                                    onDelete={() => handleAction(a.id, "delete").catch(() => {})}
                                    onDismiss={() => handleAction(a.id, "dismiss").catch(() => {})}
                                    onResolve={() => handleAction(a.id, "resolve").catch(() => {})}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Settings panel (collapsible) */}
            {showSettings && <AnnotationSettingsPanel onChange={setSettings} settings={settings} />}
        </div>
    );
};

export default AnnotationsApp;
