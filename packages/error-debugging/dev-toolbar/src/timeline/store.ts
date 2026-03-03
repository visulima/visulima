import type { TimelineEvent, TimelineGroup } from "../types/timeline";
import { DEFAULT_TIMELINE_GROUPS } from "../types/timeline";

/**
 * Timeline store for managing timeline events.
 */
class TimelineStore {
    private groups: Map<string, TimelineGroup>;

    private maxEvents: number;

    public constructor(maxEvents = 1000) {
        this.maxEvents = maxEvents;
        this.groups = new Map();

        // Initialize default groups
        for (const group of DEFAULT_TIMELINE_GROUPS) {
            this.groups.set(group.id, { ...group, events: [] });
        }
    }

    /**
     * Adds an event to a group.
     */
    public addEvent(groupId: string, event: TimelineEvent): void {
        let group = this.groups.get(groupId);

        if (!group) {
            // Create new group if it doesn't exist
            group = {
                events: [],
                id: groupId,
                label: groupId,
            };
            this.groups.set(groupId, group);
        }

        group.events.push(event);

        // Limit total events per group
        if (group.events.length > this.maxEvents) {
            group.events.shift();
        }

        // Sort events by time
        group.events = group.events.toSorted((a, b) => a.time - b.time);
    }

    /**
     * Gets all timeline groups.
     */
    public getGroups(): TimelineGroup[] {
        return [...this.groups.values()];
    }

    /**
     * Gets events for a specific group.
     */
    public getGroupEvents(groupId: string): TimelineEvent[] {
        const group = this.groups.get(groupId);

        return group?.events ?? [];
    }

    /**
     * Gets all events across all groups.
     */
    public getAllEvents(): TimelineEvent[] {
        const allEvents: TimelineEvent[] = [];

        for (const group of this.groups.values()) {
            allEvents.push(...group.events);
        }

        return allEvents.toSorted((a, b) => a.time - b.time);
    }

    /**
     * Clears events for a specific group.
     */
    public clearGroup(groupId: string): void {
        const group = this.groups.get(groupId);

        if (group) {
            group.events = [];
        }
    }

    /**
     * Clears all events from all groups.
     */
    public clearAll(): void {
        for (const group of this.groups.values()) {
            group.events = [];
        }
    }

    /**
     * Gets events within a time range.
     */
    public getEventsInRange(startTime: number, endTime: number): TimelineEvent[] {
        const allEvents = this.getAllEvents();

        return allEvents.filter((event) => event.time >= startTime && event.time <= endTime);
    }
}

/**
 * Global timeline store instance
 */
let timelineStoreInstance: TimelineStore | undefined;

/**
 * Gets or creates the timeline store singleton instance.
 */
const getTimelineStore = (): TimelineStore => {
    if (!timelineStoreInstance) {
        timelineStoreInstance = new TimelineStore();
    }

    return timelineStoreInstance;
};

export { getTimelineStore, TimelineStore };
