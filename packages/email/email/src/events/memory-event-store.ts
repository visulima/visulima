import type { EmailEvent, EventStore } from "./types";

const byTimestamp = (a: EmailEvent, b: EmailEvent): number => a.timestamp.getTime() - b.timestamp.getTime();

/**
 * An in-memory {@link EventStore}. Events are grouped by `messageId`; events without one are kept
 * under a shared `__unkeyed` bucket so nothing is silently dropped.
 */
class MemoryEventStore implements EventStore {
    private static readonly UNKEYED = "__unkeyed";

    private readonly byMessage = new Map<string, EmailEvent[]>();

    /**
     * Appends an event to its message's bucket.
     * @param event The event to store.
     */
    public append(event: EmailEvent): void {
        const key = event.messageId ?? MemoryEventStore.UNKEYED;
        const bucket = this.byMessage.get(key);

        if (bucket) {
            bucket.push(event);
        } else {
            this.byMessage.set(key, [event]);
        }
    }

    /**
     * Reconstructs the time-ordered timeline for a single message.
     * @param messageId The message to reconstruct.
     * @returns The message's events, oldest first.
     */
    public timeline(messageId: string): EmailEvent[] {
        return [...this.byMessage.get(messageId) ?? []].toSorted(byTimestamp);
    }

    /**
     * Returns every stored event, ordered by timestamp.
     * @returns All events.
     */
    public all(): EmailEvent[] {
        return [...this.byMessage.values()].flat().toSorted(byTimestamp);
    }

    /**
     * Removes all stored events.
     */
    public clear(): void {
        this.byMessage.clear();
    }
}

export default MemoryEventStore;
