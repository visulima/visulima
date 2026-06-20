import type { NotificationEvent, NotificationEventType } from "../types";

export type { EventStore } from "./event-store";
export { default as MemoryEventStore } from "./memory-event-store";

export type NotificationEventListener = (event: NotificationEvent) => void;

/**
 * A tiny synchronous event bus for notification lifecycle events. Listeners can subscribe
 * to a specific {@link NotificationEventType} or to all events with `"*"`.
 */
export class NotificationEventBus {
    readonly #listeners = new Map<NotificationEventType | "*", Set<NotificationEventListener>>();

    /**
     * Subscribes to an event type (or `"*"` for all).
     * @param type A specific {@link NotificationEventType} to listen for, or `"*"` for every event.
     * @param listener The callback invoked with each matching event.
     * @returns An unsubscribe function.
     */
    public on(type: "*" | NotificationEventType, listener: NotificationEventListener): () => void {
        const set = this.#listeners.get(type) ?? new Set<NotificationEventListener>();

        set.add(listener);
        this.#listeners.set(type, set);

        return () => set.delete(listener);
    }

    /**
     * Emits an event to matching listeners.
     * @param event The event to emit.
     */
    public emit(event: NotificationEvent): void {
        for (const listener of this.#listeners.get(event.type) ?? []) {
            listener(event);
        }

        for (const listener of this.#listeners.get("*") ?? []) {
            listener(event);
        }
    }
}
