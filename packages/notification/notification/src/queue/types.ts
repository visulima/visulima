import type { NotificationMessage } from "../notification";

/**
 * A queued notification job.
 */
export interface QueueJob {
    /** Number of delivery attempts including the current one (1 on first reserve). */
    attempts: number;
    /** Unique job id. */
    id: string;
    /** The multi-channel message to deliver. */
    message: NotificationMessage;
    /** Epoch ms before which the job must not be reserved. */
    scheduledAt?: number;
}

/**
 * A durable notification queue. The default {@link import("./memory-queue").MemoryQueue}
 * is in-process; adapters (unstorage, BullMQ, ...) back it with external stores.
 */
export interface NotificationQueue {
    /** Acknowledges a reserved job as completed, removing it. */
    ack: (id: string) => Promise<void> | void;
    /** Adds a message to the queue, returning its job id. */
    enqueue: (message: NotificationMessage, options?: { scheduledAt?: number }) => Promise<string> | string;
    /** Reserves the next due job, or undefined when none are ready. */
    reserve: () => Promise<QueueJob | undefined> | (QueueJob | undefined);
    /** Returns a reserved job to the queue, optionally delaying it. */
    retry: (id: string, delayMs?: number) => Promise<void> | void;
    /** Returns the number of pending jobs. */
    size: () => Promise<number> | number;
}
