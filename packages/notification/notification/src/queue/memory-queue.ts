import type { NotificationMessage } from "../notification";
import generateMessageId from "../providers/utils/id";
import type { NotificationQueue, QueueJob } from "./types";

/**
 * In-process {@link NotificationQueue}. Suitable for single-instance apps, tests and the
 * default worker; swap for the unstorage/BullMQ adapters for durability.
 */
class MemoryQueue implements NotificationQueue {
    readonly #pending: QueueJob[] = [];

    readonly #reserved = new Map<string, QueueJob>();

    public enqueue(message: NotificationMessage, options?: { scheduledAt?: number }): string {
        const job: QueueJob = { attempts: 0, id: generateMessageId("job"), message, scheduledAt: options?.scheduledAt };

        this.#pending.push(job);

        return job.id;
    }

    public reserve(): QueueJob | undefined {
        const now = Date.now();
        const index = this.#pending.findIndex((job) => (job.scheduledAt ?? 0) <= now);

        if (index === -1) {
            return undefined;
        }

        const job = this.#pending.splice(index, 1)[0] as QueueJob;

        job.attempts += 1;
        this.#reserved.set(job.id, job);

        return job;
    }

    public ack(id: string): void {
        this.#reserved.delete(id);
    }

    public retry(id: string, delayMs = 0): void {
        const job = this.#reserved.get(id);

        if (!job) {
            return;
        }

        this.#reserved.delete(id);
        job.scheduledAt = Date.now() + delayMs;
        this.#pending.push(job);
    }

    public size(): number {
        return this.#pending.length;
    }
}

export default MemoryQueue;
