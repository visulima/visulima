import type { NotificationMessage } from "../notification";
import type { NotificationQueue, QueueJob } from "./types";

/**
 * A pg-boss job fetched with `includeMetadata`, narrowed to the members this adapter reads.
 */
interface PgBossJobLike {
    data: unknown;
    id: string;
    /** pg-boss retry count (present when fetched with `includeMetadata`). */
    retryCount?: number;
}

/**
 * The subset of a [pg-boss](https://github.com/timgit/pg-boss) instance this adapter uses (v10 API).
 * Typed structurally so the `pg-boss` optional peer is never imported — pass a started `PgBoss` instance.
 */
interface PgBossLike {
    complete: (name: string, id: string) => Promise<unknown>;
    fail: (name: string, id: string) => Promise<unknown>;
    fetch: (name: string, options?: { batchSize?: number; includeMetadata?: boolean }) => Promise<PgBossJobLike[] | PgBossJobLike | null>;
    getQueueSize: (name: string) => Promise<number>;
    send: (name: string, data: object, options?: { startAfter?: Date }) => Promise<null | string>;
}

/**
 * Options for {@link createPgBossQueue}.
 */
export interface PgBossQueueOptions {
    /** The pg-boss queue name. */
    queueName: string;
}

/**
 * A {@link NotificationQueue} backed by [pg-boss](https://github.com/timgit/pg-boss) (Postgres, v10 API).
 *
 * Pass a started pg-boss instance — `pg-boss` is an optional peer dependency and is never started here.
 * `reserve` uses `fetch` with `includeMetadata`, so the job's `attempts` reflects pg-boss's own
 * `retryCount`. `retry` calls `fail`, so the retry delay is governed by the queue's pg-boss retry policy
 * rather than the `delayMs` argument.
 *
 * Runtime: NODE ONLY (requires a Postgres connection). Not Cloudflare Workers compatible.
 */
export class PgBossQueue implements NotificationQueue {
    readonly #boss: PgBossLike;

    readonly #queueName: string;

    public constructor(boss: PgBossLike, options: PgBossQueueOptions) {
        this.#boss = boss;
        this.#queueName = options.queueName;
    }

    public async enqueue(message: NotificationMessage, options?: { scheduledAt?: number }): Promise<string> {
        const startAfter = options?.scheduledAt === undefined ? undefined : new Date(options.scheduledAt);
        const id = await this.#boss.send(this.#queueName, message, startAfter === undefined ? {} : { startAfter });

        return id ?? "";
    }

    public async reserve(): Promise<QueueJob | undefined> {
        const fetched = await this.#boss.fetch(this.#queueName, { batchSize: 1, includeMetadata: true });

        const job = Array.isArray(fetched) ? fetched[0] : fetched;

        if (!job) {
            return undefined;
        }

        return { attempts: job.retryCount ?? 0, id: job.id, message: job.data as NotificationMessage, scheduledAt: 0 };
    }

    public async ack(id: string): Promise<void> {
        await this.#boss.complete(this.#queueName, id);
    }

    public async retry(id: string): Promise<void> {
        // pg-boss reschedules failed jobs per the queue's retry policy.
        await this.#boss.fail(this.#queueName, id);
    }

    public async size(): Promise<number> {
        return await this.#boss.getQueueSize(this.#queueName);
    }
}

/**
 * Convenience factory for {@link PgBossQueue}.
 * @param boss A started pg-boss instance (optional peer).
 * @param options Queue options. See {@link PgBossQueueOptions}.
 * @returns A new {@link PgBossQueue}.
 */
export const createPgBossQueue = (boss: PgBossLike, options: PgBossQueueOptions): PgBossQueue => new PgBossQueue(boss, options);

export type { PgBossJobLike, PgBossLike };
