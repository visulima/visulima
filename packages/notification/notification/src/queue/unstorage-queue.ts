import type { Storage } from "unstorage";

import type { NotificationMessage } from "../notification";
import generateMessageId from "../providers/utils/id";
import type { NotificationQueue, QueueJob } from "./types";

/**
 * A stored job document. `reserved` marks a job that a worker has taken and not yet
 * acked/retried, so a second `reserve` scan skips it.
 */
interface StoredJob extends QueueJob {
    reserved?: boolean;
}

/**
 * A {@link NotificationQueue} backed by an [unstorage](https://unstorage.unjs.io) driver,
 * giving durable, multi-backend persistence (Redis, filesystem, KV, ...). `unstorage` is
 * an optional peer dependency — pass a configured `Storage` instance.
 *
 * Each job is a single self-contained document keyed by the configured prefix followed by `:job:` and the job id;
 * there is no shared pending index, so concurrent `enqueue`s cannot lose-update each other.
 * `reserve` scans the job documents under the prefix for the next due, unreserved job and
 * marks it reserved. Individual reads/writes are still not transactional, so two workers
 * racing `reserve` on the *same* job can both take it (double delivery); for that level of
 * contention prefer a store with atomic guarantees, or reserve from one instance.
 */
export class UnstorageQueue implements NotificationQueue {
    readonly #storage: Storage;

    readonly #prefix: string;

    public constructor(storage: Storage, prefix = "notification:queue") {
        this.#storage = storage;
        this.#prefix = prefix;
    }

    public async enqueue(message: NotificationMessage, options?: { scheduledAt?: number }): Promise<string> {
        const job: StoredJob = { attempts: 0, id: generateMessageId("job"), message, scheduledAt: options?.scheduledAt };

        await this.#storage.setItem(this.#jobKey(job.id), job as never);

        return job.id;
    }

    public async reserve(): Promise<QueueJob | undefined> {
        const now = Date.now();
        const keys = await this.#storage.getKeys(this.#jobPrefix());

        for (const key of keys) {
            // eslint-disable-next-line no-await-in-loop
            const job = (await this.#storage.getItem(key)) as StoredJob | null;

            if (job && !job.reserved && (job.scheduledAt ?? 0) <= now) {
                job.attempts += 1;
                job.reserved = true;
                // eslint-disable-next-line no-await-in-loop
                await this.#storage.setItem(key, job as never);

                return { attempts: job.attempts, id: job.id, message: job.message, scheduledAt: job.scheduledAt };
            }
        }

        return undefined;
    }

    public async ack(id: string): Promise<void> {
        await this.#storage.removeItem(this.#jobKey(id));
    }

    public async retry(id: string, delayMs = 0): Promise<void> {
        const job = (await this.#storage.getItem(this.#jobKey(id))) as StoredJob | null;

        if (!job) {
            return;
        }

        job.scheduledAt = Date.now() + delayMs;
        job.reserved = false;
        await this.#storage.setItem(this.#jobKey(id), job as never);
    }

    public async size(): Promise<number> {
        const keys = await this.#storage.getKeys(this.#jobPrefix());
        const jobs = await Promise.all(keys.map(async (key) => this.#storage.getItem(key) as Promise<StoredJob | null>));

        return jobs.filter((job) => job !== null && !job.reserved).length;
    }

    #jobPrefix(): string {
        return `${this.#prefix}:job:`;
    }

    #jobKey(id: string): string {
        return `${this.#jobPrefix()}${id}`;
    }
}

/**
 * Convenience factory for {@link UnstorageQueue}.
 * @param storage A configured unstorage `Storage` instance.
 * @param prefix Key prefix under which jobs are stored.
 * @returns A new {@link UnstorageQueue}.
 */
export const createUnstorageQueue = (storage: Storage, prefix?: string): UnstorageQueue => new UnstorageQueue(storage, prefix);
