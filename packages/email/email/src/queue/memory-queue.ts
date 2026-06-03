import type { EmailOptions } from "../types";
import type { EmailQueue, EnqueueOptions, QueueJob } from "./types";

interface InternalJob extends QueueJob {
    reservedUntil: number;
}

/**
 * Options for {@link MemoryQueue}.
 */
export interface MemoryQueueOptions {
    /**
     * Time source in milliseconds — injectable for tests. Defaults to `Date.now`.
     */
    now?: () => number;

    /**
     * How long, in milliseconds, a reserved job stays hidden before it becomes deliverable again
     * (in case the worker crashed mid-process).
     * @default 30000
     */
    visibilityTimeout?: number;
}

/**
 * An in-memory {@link EmailQueue} with `scheduledAt` support and a reservation visibility timeout.
 *
 * Suitable for tests, single-process apps, and as a reference for adapter authors. Jobs do not survive
 * a process restart — use a durable adapter in production.
 */
export class MemoryQueue implements EmailQueue {
    private readonly jobs = new Map<string, InternalJob>();

    private readonly visibilityTimeout: number;

    private readonly now: () => number;

    private sequence = 0;

    /**
     * @param options Queue options. See {@link MemoryQueueOptions}.
     */
    public constructor(options: MemoryQueueOptions = {}) {
        this.visibilityTimeout = options.visibilityTimeout ?? 30_000;
        this.now = options.now ?? Date.now;
    }

    /**
     * Adds a message to the queue.
     * @param message The message to send later.
     * @param options Optional scheduling. See {@link EnqueueOptions}.
     * @returns The new job id.
     */
    public enqueue(message: EmailOptions, options: EnqueueOptions = {}): string {
        this.sequence += 1;
        const id = `job_${String(this.sequence)}`;

        const scheduledAt = options.scheduledAt instanceof Date ? options.scheduledAt.getTime() : options.scheduledAt ?? this.now();

        this.jobs.set(id, { attempts: 0, id, message, reservedUntil: 0, scheduledAt });

        return id;
    }

    /**
     * Reserves the next ready job, hiding it for the visibility window.
     * @returns The next deliverable job, or `undefined` when none is ready.
     */
    public reserve(): QueueJob | undefined {
        const current = this.now();

        for (const job of this.jobs.values()) {
            if (job.scheduledAt <= current && job.reservedUntil <= current) {
                job.reservedUntil = current + this.visibilityTimeout;

                return { attempts: job.attempts, id: job.id, message: job.message, scheduledAt: job.scheduledAt };
            }
        }

        return undefined;
    }

    /**
     * Marks a reserved job as processed and removes it.
     * @param id The job id.
     */
    public ack(id: string): void {
        this.jobs.delete(id);
    }

    /**
     * Returns a job to the queue after a delay, incrementing its attempt count.
     * @param id The job id.
     * @param delayMs Milliseconds to wait before the job becomes ready again.
     */
    public retry(id: string, delayMs = 0): void {
        const job = this.jobs.get(id);

        if (!job) {
            return;
        }

        job.attempts += 1;
        job.reservedUntil = 0;
        job.scheduledAt = this.now() + delayMs;
    }

    /**
     * Reports how many jobs remain (ready plus reserved).
     * @returns The count of ready and reserved jobs.
     */
    public size(): number {
        return this.jobs.size;
    }
}
