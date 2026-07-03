import type { EmailOptions } from "../types";

/**
 * A queued email job.
 */
export interface QueueJob {
    /**
     * Number of delivery attempts so far.
     */
    attempts: number;

    /**
     * Unique job id.
     */
    id: string;

    /**
     * The message to send.
     */
    message: EmailOptions;

    /**
     * Earliest time (ms since epoch) the job may be delivered. Used for `scheduledAt` and retry backoff.
     */
    scheduledAt: number;
}

/**
 * Options when enqueueing a message.
 */
export interface EnqueueOptions {
    /**
     * Deliver no earlier than this time. Accepts a `Date` or epoch milliseconds.
     */
    scheduledAt?: Date | number;
}

/**
 * A durable email queue. The in-memory default (`MemoryQueue`) implements this; adapters can
 * back it with Redis/BullMQ, pg-boss, SQS, or `unstorage`.
 *
 * Delivery is reserve → ack/retry: {@link EmailQueue.reserve} hands out a job and hides it for a
 * visibility window; the worker then {@link EmailQueue.ack}s it on success or {@link EmailQueue.retry}s
 * it on failure.
 */
export interface EmailQueue {
    /**
     * Marks a reserved job as successfully processed and removes it.
     * @param id The job id.
     */
    ack: (id: string) => Promise<void> | void;

    /**
     * Adds a message to the queue.
     * @param message The message to send later.
     * @param options Optional scheduling. See {@link EnqueueOptions}.
     * @returns The new job id.
     */
    enqueue: (message: EmailOptions, options?: EnqueueOptions) => Promise<string> | string;

    /**
     * Reserves the next ready job, hiding it from other workers for a visibility window.
     * @returns The next job, or `undefined` when none is ready.
     */
    reserve: () => (QueueJob | undefined) | Promise<QueueJob | undefined>;

    /**
     * Returns a reserved job to the queue, optionally after a delay, incrementing its attempt count.
     * @param id The job id.
     * @param delayMs Milliseconds to wait before the job becomes ready again.
     */
    retry: (id: string, delayMs?: number) => Promise<void> | void;

    /**
     * The number of jobs not yet acked (ready + reserved).
     */
    size: () => number | Promise<number>;
}
