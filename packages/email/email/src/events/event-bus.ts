import type { EmailEvent, EmailEventListener, EmailEventType } from "./types";

type Selector = "*" | EmailEventType;

/**
 * The wildcard selector that subscribes to every event type.
 */
export const ALL_EVENTS = "*" as const;

/**
 * A tiny synchronous pub/sub bus for {@link EmailEvent}s.
 *
 * Subscribe to a specific {@link EmailEventType} or to {@link ALL_EVENTS} (`"*"`) for every event.
 */
export class EventBus {
    private readonly listeners = new Map<Selector, Set<EmailEventListener>>();

    /**
     * Subscribes a listener to an event type (or all events).
     * @param type The event type, or `"*"` for all events.
     * @param listener The listener to invoke.
     * @returns An unsubscribe function.
     */
    public on(type: Selector, listener: EmailEventListener): () => void {
        let set = this.listeners.get(type);

        if (!set) {
            set = new Set();
            this.listeners.set(type, set);
        }

        set.add(listener);

        return () => {
            this.off(type, listener);
        };
    }

    /**
     * Subscribes a listener that is removed after its first invocation.
     * @param type The event type, or `"*"` for all events.
     * @param listener The listener to invoke once.
     * @returns An unsubscribe function.
     */
    public once(type: Selector, listener: EmailEventListener): () => void {
        const wrapped: EmailEventListener = (event) => {
            this.off(type, wrapped);
            listener(event);
        };

        return this.on(type, wrapped);
    }

    /**
     * Removes a previously-added listener.
     * @param type The event type the listener was registered under.
     * @param listener The listener to remove.
     */
    public off(type: Selector, listener: EmailEventListener): void {
        this.listeners.get(type)?.delete(listener);
    }

    /**
     * Emits an event to all matching listeners (type-specific first, then wildcard).
     * @param event The event to dispatch.
     */
    public emit(event: EmailEvent): void {
        const invoke = (listener: EmailEventListener): void => {
            try {
                listener(event);
            } catch {
                // Isolate subscriber failures so one throwing listener can't drop the others
                // (e.g. a failing metrics observer must not break persistence).
            }
        };

        for (const listener of this.listeners.get(event.type) ?? []) {
            invoke(listener);
        }

        for (const listener of this.listeners.get(ALL_EVENTS) ?? []) {
            invoke(listener);
        }
    }

    /**
     * Removes all listeners (optionally for a single type).
     * @param type When provided, only listeners for this type are removed.
     */
    public clear(type?: Selector): void {
        if (type === undefined) {
            this.listeners.clear();
        } else {
            this.listeners.delete(type);
        }
    }
}
