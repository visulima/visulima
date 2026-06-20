import type { Storage } from "unstorage";

import type { NotificationMessage } from "../notification";
import generateMessageId from "../providers/utils/id";
import type { NotificationQueue, QueueJob } from "./types";

/**
 * A {@link NotificationQueue} backed by an [unstorage](https://unstorage.unjs.io) driver,
 * giving durable, multi-backend persistence (Redis, filesystem, KV, ...). `unstorage` is
 * an optional peer dependency — pass a configured `Storage` instance.
 */
export class UnstorageQueue implements NotificationQueue {
    readonly #storage: Storage;

    readonly #prefix: string;

    public constructor(storage: Storage, prefix = "notification:queue") {
        this.#storage = storage;
        this.#prefix = prefix;
    }

    public async enqueue(message: NotificationMessage, options?: { scheduledAt?: number }): Promise<string> {
        const job: QueueJob = { attempts: 0, id: generateMessageId("job"), message, scheduledAt: options?.scheduledAt };

        await this.#storage.setItem(this.#jobKey(job.id), job as never);
        await this.#pushPending(job.id);

        return job.id;
    }

    public async reserve(): Promise<QueueJob | undefined> {
        const now = Date.now();
        const pending = await this.#pending();

        for (const id of pending) {
            // eslint-disable-next-line no-await-in-loop
            const job = (await this.#storage.getItem(this.#jobKey(id))) as QueueJob | null;

            if (job && (job.scheduledAt ?? 0) <= now) {
                job.attempts += 1;
                // eslint-disable-next-line no-await-in-loop
                await this.#storage.setItem(this.#jobKey(id), job as never);
                // eslint-disable-next-line no-await-in-loop
                await this.#setPending(pending.filter((pendingId) => pendingId !== id));

                return job;
            }
        }

        return undefined;
    }

    public async ack(id: string): Promise<void> {
        await this.#storage.removeItem(this.#jobKey(id));
    }

    public async retry(id: string, delayMs = 0): Promise<void> {
        const job = (await this.#storage.getItem(this.#jobKey(id))) as QueueJob | null;

        if (!job) {
            return;
        }

        job.scheduledAt = Date.now() + delayMs;
        await this.#storage.setItem(this.#jobKey(id), job as never);
        await this.#pushPending(id);
    }

    public async size(): Promise<number> {
        const pending = await this.#pending();

        return pending.length;
    }

    #jobKey(id: string): string {
        return `${this.#prefix}:job:${id}`;
    }

    async #pending(): Promise<string[]> {
        return ((await this.#storage.getItem(`${this.#prefix}:pending`)) as string[] | null) ?? [];
    }

    async #setPending(ids: string[]): Promise<void> {
        await this.#storage.setItem(`${this.#prefix}:pending`, ids as never);
    }

    async #pushPending(id: string): Promise<void> {
        const pending = await this.#pending();

        if (!pending.includes(id)) {
            pending.push(id);
            await this.#setPending(pending);
        }
    }
}

/**
 * Convenience factory for {@link UnstorageQueue}.
 * @param storage A configured unstorage `Storage` instance.
 * @param prefix Key prefix under which jobs are stored.
 * @returns A new {@link UnstorageQueue}.
 */
export const createUnstorageQueue = (storage: Storage, prefix?: string): UnstorageQueue => new UnstorageQueue(storage, prefix);
