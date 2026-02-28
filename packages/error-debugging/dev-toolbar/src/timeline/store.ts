import type { TimelineEvent, TimelineGroup } from "../types/timeline";
import { DEFAULT_TIMELINE_GROUPS } from "../types/timeline";

/**
 * Timeline store for managing events
 */
export class TimelineStore {
    private groups: Map<string, TimelineGroup>;

    private maxEvents: number;

    constructor(maxEvents = 1000) {
        this.maxEvents = maxEvents;
        this.groups = new Map();

        // Initialize default groups
        for (const group of DEFAULT_TIMELINE_GROUPS) {
            this.groups.set(group.id, { ...group, events: [] });
        }
    }

    /**
     * Add an event to a group
     * @param groupId Group ID
     * @param event Timeline event
     */
    addEvent(groupId: string, event: TimelineEvent): void {
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
        group.events.sort((a, b) => a.time - b.time);
    }

    /**
     * Get all groups
     * @returns Array of timeline groups
     */
    getGroups(): TimelineGroup[] {
        return [...this.groups.values()];
    }

    /**
     * Get events for a specific group
     * @param groupId Group ID
     * @returns Array of events or empty array
     */
    getGroupEvents(groupId: string): TimelineEvent[] {
        const group = this.groups.get(groupId);

        return group?.events || [];
    }

    /**
     * Get all events across all groups
     * @returns Array of all events
     */
    getAllEvents(): TimelineEvent[] {
        const allEvents: TimelineEvent[] = [];

        for (const group of this.groups.values()) {
            allEvents.push(...group.events);
        }

        return allEvents.sort((a, b) => a.time - b.time);
    }

    /**
     * Clear events for a group
     * @param groupId Group ID
     */
    clearGroup(groupId: string): void {
        const group = this.groups.get(groupId);

        if (group) {
            group.events = [];
        }
    }

    /**
     * Clear all events
     */
    clearAll(): void {
        for (const group of this.groups.values()) {
            group.events = [];
        }
    }

    /**
     * Get events within a time range
     * @param startTime Start timestamp
     * @param endTime End timestamp
     * @returns Array of events in range
     */
    getEventsInRange(startTime: number, endTime: number): TimelineEvent[] {
        const allEvents = this.getAllEvents();

        return allEvents.filter((event) => event.time >= startTime && event.time <= endTime);
    }
}

/**
 * Global timeline store instance
 */
let timelineStoreInstance: TimelineStore | undefined;

/**
 * Get or create timeline store instance
 * @returns Timeline store instance
 */
export const getTimelineStore = (): TimelineStore => {
    if (!timelineStoreInstance) {
        timelineStoreInstance = new TimelineStore();
    }

    return timelineStoreInstance;
};
