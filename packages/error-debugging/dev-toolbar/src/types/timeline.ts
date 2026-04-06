/**
 * Severity levels for timeline events.
 */
export type TimelineEventLevel = "info" | "warning" | "error";

/**
 * A single captured event displayed in the timeline panel.
 */
export interface TimelineEvent {
    /**
     * Optional event data
     */

    data?: Record<string, any>;

    /**
     * Optional duration (milliseconds)
     */
    duration?: number;

    /**
     * Unique event ID
     */
    id: string;

    /**
     * Event level
     */
    level?: TimelineEventLevel;

    /**
     * Optional subtitle
     */
    subtitle?: string;

    /**
     * Timestamp (milliseconds since epoch)
     */
    time: number;

    /**
     * Event title
     */
    title: string;
}

/**
 * A named group that holds related timeline events.
 */
export interface TimelineGroup {
    /**
     * Group color (hex or CSS color)
     */
    color?: string;

    /**
     * Events in this group
     */
    events: TimelineEvent[];

    /**
     * Group ID
     */
    id: string;

    /**
     * Group label
     */
    label: string;
}

/**
 * Default timeline groups
 */
export const DEFAULT_TIMELINE_GROUPS: ReadonlyArray<TimelineGroup> = [
    {
        color: "#10B981",
        events: [],
        id: "hmr",
        label: "HMR Updates",
    },
    {
        color: "#3B82F6",
        events: [],
        id: "network",
        label: "Network",
    },
    {
        color: "#EF4444",
        events: [],
        id: "errors",
        label: "Errors",
    },
    {
        color: "#8B5CF6",
        events: [],
        id: "custom",
        label: "Custom",
    },
] as const;
