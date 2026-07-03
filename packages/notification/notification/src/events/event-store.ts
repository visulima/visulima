import type { NotificationEvent } from "../types";

/**
 * An append-only timeline store for notification events.
 */
export interface EventStore {
    append: (event: NotificationEvent) => void | Promise<void>;
    timeline: (messageId: string) => NotificationEvent[] | Promise<NotificationEvent[]>;
}
