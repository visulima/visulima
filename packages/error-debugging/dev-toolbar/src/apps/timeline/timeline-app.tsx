/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { getTimelineStore } from "../../timeline/index";
import type { TimelineEvent, TimelineGroup } from "../../types/timeline";
import { DEFAULT_TIMELINE_GROUPS } from "../../types/timeline";
import type { AppComponentProps } from "../../types/app";
import cn from "../../utils/cn";

const POLL_INTERVAL = 500;

const ALL_TAB = "all";

const formatTime = (ms: number): string => {
    const d = new Date(ms);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
};

const LevelBadge = ({ level }: { level?: string }): ComponentChildren => {
    if (!level) {
        return null;
    }

    const colors: Record<string, string> = {
        error: "bg-destructive/15 text-destructive border-destructive/30",
        info: "bg-info/15 text-info border-info/30",
        warning: "bg-warning/15 text-warning border-warning/30",
    };

    return (
        <span class={cn("inline-flex items-center px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider border", colors[level] ?? colors.info)}>
            {level}
        </span>
    );
};

interface EventDetailProps {
    event: TimelineEvent;
    onClose: () => void;
}

const EventDetail = ({ event, onClose }: EventDetailProps): ComponentChildren => (
    <div class="border-l border-border bg-background h-full flex flex-col min-w-0 w-80 shrink-0">
        <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
            <span class="text-[0.75rem] font-semibold text-foreground truncate">{event.title}</span>
            <button
                aria-label="Close detail"
                class="size-5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer border-0 bg-transparent shrink-0"
                onClick={onClose}
                type="button"
            >
                ✕
            </button>
        </div>
        <div class="flex-1 overflow-auto p-4 space-y-3">
            <div class="space-y-1">
                <div class="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-medium">Time</div>
                <div class="text-[0.8rem] font-mono text-foreground">{formatTime(event.time)}</div>
            </div>
            {event.subtitle && (
                <div class="space-y-1">
                    <div class="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-medium">Subtitle</div>
                    <div class="text-[0.8rem] text-foreground">{event.subtitle}</div>
                </div>
            )}
            {event.duration !== undefined && (
                <div class="space-y-1">
                    <div class="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-medium">Duration</div>
                    <div class="text-[0.8rem] font-mono text-foreground">{event.duration}ms</div>
                </div>
            )}
            {event.level && (
                <div class="space-y-1">
                    <div class="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-medium">Level</div>
                    <LevelBadge level={event.level} />
                </div>
            )}
            {event.data && Object.keys(event.data).length > 0 && (
                <div class="space-y-1">
                    <div class="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-medium">Data</div>
                    <pre class="text-[0.7rem] font-mono text-foreground/80 bg-foreground/[0.04] p-3 overflow-auto border border-border/50 whitespace-pre-wrap break-all">
                        {JSON.stringify(event.data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    </div>
);

const TimelineApp = (_props: AppComponentProps): ComponentChildren => {
    const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
    const [groups, setGroups] = useState<TimelineGroup[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refresh = (): void => {
        const store = getTimelineStore();
        setGroups(store.getGroups().map((g) => ({ ...g, events: [...g.events] })));
    };

    useEffect(() => {
        refresh();
        intervalRef.current = setInterval(refresh, POLL_INTERVAL);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    const groupColorMap = new Map(DEFAULT_TIMELINE_GROUPS.map((g) => [g.id, g.color]));

    const tabs = [{ id: ALL_TAB, label: "All", color: undefined }, ...groups.map((g) => ({ id: g.id, label: g.label, color: groupColorMap.get(g.id) ?? g.color }))];

    const visibleEvents: TimelineEvent[] =
        activeTab === ALL_TAB
            ? groups.flatMap((g) => g.events).sort((a, b) => a.time - b.time)
            : (groups.find((g) => g.id === activeTab)?.events ?? []);

    const clearAll = (): void => {
        const store = getTimelineStore();
        store.clearAll();
        setSelectedEvent(null);
        refresh();
    };

    return (
        <div class="flex flex-col h-full">
            {/* Toolbar row */}
            <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-border shrink-0">
                {/* Group tabs */}
                <div class="flex items-center gap-0 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            class={cn(
                                "px-3 py-1.5 text-[0.75rem] font-medium whitespace-nowrap border-0 cursor-pointer transition-colors duration-150",
                                activeTab === tab.id
                                    ? "text-foreground border-b-2 border-primary bg-transparent"
                                    : "text-muted-foreground bg-transparent hover:text-foreground",
                            )}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setSelectedEvent(null);
                            }}
                            type="button"
                        >
                            {tab.color && (
                                <span
                                    class="inline-block size-2 rounded-full mr-1.5 align-middle"
                                    style={{ backgroundColor: tab.color }}
                                />
                            )}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <button
                    class={cn(
                        "px-2.5 py-1 text-[0.725rem] font-medium border border-border",
                        "text-muted-foreground hover:text-foreground hover:border-foreground/30",
                        "cursor-pointer bg-transparent transition-colors duration-150",
                    )}
                    onClick={clearAll}
                    title="Clear all events"
                    type="button"
                >
                    Clear
                </button>
            </div>

            {/* Content area */}
            <div class="flex flex-1 min-h-0 overflow-hidden">
                {/* Events list */}
                <div class="flex-1 overflow-auto">
                    {visibleEvents.length === 0 ? (
                        <div class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center select-none">
                            <div class="size-12 border border-border/50 bg-foreground/[0.02] flex items-center justify-center">
                                <svg aria-hidden="true" class="size-5 text-muted-foreground/40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                                    <path d="M12 6v6h4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </div>
                            <div class="space-y-1">
                                <p class="text-[0.8rem] font-medium text-foreground/60">No events recorded yet</p>
                                <p class="text-[0.7rem] text-muted-foreground">Events appear here as your app runs</p>
                                <p class="text-[0.65rem] text-muted-foreground/50 mt-2 max-w-[240px] leading-relaxed">HMR updates, network requests, and custom events are captured automatically</p>
                            </div>
                        </div>
                    ) : (
                        <div class="divide-y divide-border/50">
                            {visibleEvents.map((event) => {
                                const group = groups.find((g) => g.events.some((e) => e.id === event.id));
                                const color = groupColorMap.get(group?.id ?? "") ?? group?.color;

                                return (
                                    <button
                                        key={event.id}
                                        class={cn(
                                            "w-full flex items-start gap-3 px-4 py-3 text-left border-0 bg-transparent cursor-pointer",
                                            "hover:bg-foreground/[0.04] transition-colors duration-100",
                                            selectedEvent?.id === event.id && "bg-primary/[0.06]",
                                        )}
                                        onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                                        type="button"
                                    >
                                        {color && (
                                            <span
                                                class="mt-1 size-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: color }}
                                            />
                                        )}
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <span class="text-[0.8rem] font-medium text-foreground truncate">{event.title}</span>
                                                <LevelBadge level={event.level} />
                                            </div>
                                            {event.subtitle && (
                                                <div class="text-[0.725rem] text-muted-foreground truncate mt-0.5">{event.subtitle}</div>
                                            )}
                                        </div>
                                        <span class="text-[0.65rem] font-mono text-muted-foreground/70 shrink-0 mt-0.5">{formatTime(event.time)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Detail panel */}
                {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
            </div>
        </div>
    );
};

export default TimelineApp;
