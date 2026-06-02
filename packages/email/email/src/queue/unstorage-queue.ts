import { randomUUID } from "node:crypto";

import type { Storage } from "unstorage";

import type { EmailOptions } from "../types";
import type { EmailQueue, EnqueueOptions, QueueJob } from "./types";

interface StoredJob extends QueueJob {
    reservedUntil: number;
}

/**
 * Options for {@link UnstorageQueue}.
 */
export interface UnstorageQueueOptions {
    /**
     * Time source in milliseconds — injectable for tests. Defaults to `Date.now`.
     */
    now?: () => number;

    /**
     * Key prefix under which jobs are stored.
     * @default "email:queue"
     */
    prefix?: string;

    /**
     * How long, in milliseconds, a reserved job stays hidden before becoming deliverable again.
     * @default 30000
     */
    visibilityTimeout?: number;
}

/**
 * A durable {@link EmailQueue} backed by an [unstorage](https://unstorage.unjs.io/) `Storage`.
 *
 * Because unstorage abstracts many backends (memory, filesystem, Redis, Cloudflare KV, Postgres, …),
 * a single adapter persists the queue across all of them. The stored `message` must be
 * JSON-serializable (avoid `Buffer` attachments — pass `path`/`href`/base64 `content` instead).
 *
 * Note: unstorage has no transactions, so {@link UnstorageQueue.reserve} is best-effort under
 * concurrent workers; the visibility timeout bounds duplicate delivery on a crash.
 */
export class UnstorageQueue implements EmailQueue {
    private readonly storage: Storage;

    private readonly prefix: string;

    private readonly visibilityTimeout: number;

    private readonly now: () => number;

    /**
     * @param storage The unstorage instance to persist jobs in.
     * @param options Adapter options. See {@link UnstorageQueueOptions}.
     */
    public constructor(storage: Storage, options: UnstorageQueueOptions = {}) {
        this.storage = storage;
        this.prefix = options.prefix ?? "email:queue";
        this.visibilityTimeout = options.visibilityTimeout ?? 30_000;
        this.now = options.now ?? Date.now;
    }

    /**
     * Persists a message to the store.
     * @param message The message to send later.
     * @param options Optional scheduling. See {@link EnqueueOptions}.
     * @returns The new job id.
     */
    public async enqueue(message: EmailOptions, options: EnqueueOptions = {}): Promise<string> {
        const id = randomUUID();
        const scheduledAt = options.scheduledAt instanceof Date ? options.scheduledAt.getTime() : options.scheduledAt ?? this.now();
        const job: StoredJob = { attempts: 0, id, message, reservedUntil: 0, scheduledAt };

        await this.storage.setItem(this.keyOf(id), job);

        return id;
    }

    /**
     * Reserves the next ready job, hiding it for the visibility window.
     * @returns The next deliverable job, or `undefined` when none is ready.
     */
    public async reserve(): Promise<QueueJob | undefined> {
        const current = this.now();
        const keys = await this.storage.getKeys(this.prefix);

        for (const key of keys) {
            // eslint-disable-next-line no-await-in-loop
            const job = await this.storage.getItem<StoredJob>(key);

            if (job && job.scheduledAt <= current && job.reservedUntil <= current) {
                job.reservedUntil = current + this.visibilityTimeout;

                // eslint-disable-next-line no-await-in-loop
                await this.storage.setItem(key, job);

                return { attempts: job.attempts, id: job.id, message: job.message, scheduledAt: job.scheduledAt };
            }
        }

        return undefined;
    }

    /**
     * Removes a processed job from the store.
     * @param id The job id.
     */
    public async ack(id: string): Promise<void> {
        await this.storage.removeItem(this.keyOf(id));
    }

    /**
     * Requeues a job after a delay, incrementing its attempt count.
     * @param id The job id.
     * @param delayMs Milliseconds to wait before the job becomes ready again.
     */
    public async retry(id: string, delayMs = 0): Promise<void> {
        const key = this.keyOf(id);
        const job = await this.storage.getItem<StoredJob>(key);

        if (!job) {
            return;
        }

        job.attempts += 1;
        job.reservedUntil = 0;
        job.scheduledAt = this.now() + delayMs;

        await this.storage.setItem(key, job);
    }

    /**
     * Counts the jobs currently in the store.
     * @returns The number of stored (ready plus reserved) jobs.
     */
    public async size(): Promise<number> {
        const keys = await this.storage.getKeys(this.prefix);

        return keys.length;
    }

    private keyOf(id: string): string {
        return `${this.prefix}:${id}`;
    }
}

/**
 * Creates an {@link UnstorageQueue}.
 * @param storage The unstorage instance to persist jobs in.
 * @param options Adapter options. See {@link UnstorageQueueOptions}.
 * @returns A new {@link UnstorageQueue}.
 */
export const createUnstorageQueue = (storage: Storage, options?: UnstorageQueueOptions): UnstorageQueue => new UnstorageQueue(storage, options);
