import type { NotificationEvent } from "../types";
import type { EventStore } from "./event-store";

/**
 * In-memory {@link EventStore} keyed by message id.
 */
class MemoryEventStore implements EventStore {
    readonly #events = new Map<string, NotificationEvent[]>();

    public append(event: NotificationEvent): void {
        const list = this.#events.get(event.messageId) ?? [];

        list.push(event);
        this.#events.set(event.messageId, list);
    }

    public timeline(messageId: string): NotificationEvent[] {
        return this.#events.get(messageId) ?? [];
    }
}

export default MemoryEventStore;
