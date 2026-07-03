import type { EmailOptions } from "../types";
import type { EmailQueue, EnqueueOptions, QueueJob } from "./types";

interface PgBossJob {
    data: unknown;
    id: string;
    /** pg-boss retry count (present when fetched with `includeMetadata`). */
    retryCount?: number;
}

/**
 * The subset of a [pg-boss](https://github.com/timgit/pg-boss) instance this adapter uses (v10 API).
 */
interface PgBossLike {
    complete: (name: string, id: string) => Promise<unknown>;
    fail: (name: string, id: string) => Promise<unknown>;
    fetch: (name: string, options?: { batchSize?: number; includeMetadata?: boolean }) => Promise<PgBossJob[] | PgBossJob | null>;
    getQueueSize: (name: string) => Promise<number>;
    send: (name: string, data: object, options?: { startAfter?: Date | number | string }) => Promise<null | string>;
}

/**
 * Options for {@link createPgBossQueue}.
 */
interface PgBossQueueOptions {
    /**
     * The pg-boss queue name.
     */
    queueName: string;
}

/**
 * An {@link EmailQueue} backed by [pg-boss](https://github.com/timgit/pg-boss) (Postgres).
 *
 * Pass a started pg-boss instance (an optional peer). `reserve` uses `fetch` with `includeMetadata`, so
 * the job's `attempts` reflects pg-boss's own `retryCount` (letting `createWorker`'s `maxAttempts`
 * dead-lettering work). `retry` calls `fail`, so the retry *delay* is governed by the queue's pg-boss
 * retry policy (`retryDelay`/`retryBackoff`) rather than the worker's `delayMs` argument.
 */
class PgBossQueue implements EmailQueue {
    private readonly boss: PgBossLike;

    private readonly queueName: string;

    public constructor(boss: PgBossLike, options: PgBossQueueOptions) {
        this.boss = boss;
        this.queueName = options.queueName;
    }

    /** Enqueues the message. */
    public async enqueue(message: EmailOptions, options: EnqueueOptions = {}): Promise<string> {
        const startAfter = options.scheduledAt;
        const id = await this.boss.send(this.queueName, message, startAfter === undefined ? undefined : { startAfter });

        return id ?? "";
    }

    /** Reserves the next ready job. */
    public async reserve(): Promise<QueueJob | undefined> {
        const fetched = await this.boss.fetch(this.queueName, { batchSize: 1, includeMetadata: true });

        if (!fetched) {
            return undefined;
        }

        const job = Array.isArray(fetched) ? fetched[0] : fetched;

        if (!job) {
            return undefined;
        }

        // Surface pg-boss's retryCount so the worker's maxAttempts/dead-letter logic can converge.
        return { attempts: job.retryCount ?? 0, id: job.id, message: job.data as EmailOptions, scheduledAt: 0 };
    }

    /** Acknowledges (removes) a processed job. */
    public async ack(id: string): Promise<void> {
        await this.boss.complete(this.queueName, id);
    }

    /** Requeues a job for another attempt. */
    public async retry(id: string): Promise<void> {
        // pg-boss reschedules failed jobs per the queue's retry policy.
        await this.boss.fail(this.queueName, id);
    }

    /** Returns the number of queued jobs. */
    public async size(): Promise<number> {
        return this.boss.getQueueSize(this.queueName);
    }
}

/**
 * Creates an {@link EmailQueue} backed by pg-boss.
 * @param boss A started pg-boss instance (optional peer).
 * @param options Queue options. See {@link PgBossQueueOptions}.
 * @returns The pg-boss-backed queue.
 */
const createPgBossQueue = (boss: PgBossLike, options: PgBossQueueOptions): EmailQueue => new PgBossQueue(boss, options);

export type { PgBossLike, PgBossQueueOptions };
export { createPgBossQueue };
