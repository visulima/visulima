import type { NotificationMessage } from "../notification";
import type { NotificationQueue, QueueJob } from "./types";

/**
 * A BullMQ job, narrowed to the members this adapter reads.
 */
interface BullmqJobLike {
    attemptsMade: number;
    data: unknown;
    id?: string;
    moveToDelayed: (timestamp: number) => Promise<unknown>;
    remove: () => Promise<unknown>;
}

/**
 * The subset of a [BullMQ](https://docs.bullmq.io/) `Queue` this adapter uses. Typed structurally so
 * the `bullmq` optional peer is never imported — pass a real `Queue` instance, which satisfies this.
 */
interface BullmqQueueLike {
    add: (name: string, data: unknown, options?: { delay?: number }) => Promise<{ id?: string }>;
    count: () => Promise<number>;
    getJob: (id: string) => Promise<BullmqJobLike | undefined>;
    getNextJob: (token: string) => Promise<BullmqJobLike | undefined>;
}

/**
 * A {@link NotificationQueue} backed by [BullMQ](https://docs.bullmq.io/) (Redis).
 *
 * BullMQ is push-based: jobs are normally consumed by a BullMQ `Worker`. This adapter maps the
 * pull-based reserve/ack model onto BullMQ's `getNextJob`-style primitives so it composes with the
 * notification `QueueWorker`. Pass an already-configured `Queue` instance — `bullmq` is an optional
 * peer dependency and is never instantiated here.
 *
 * Runtime: NODE ONLY (requires a Redis connection). Not Cloudflare Workers compatible.
 */
export class BullMqQueue implements NotificationQueue {
    readonly #queue: BullmqQueueLike;

    readonly #jobName: string;

    public constructor(queue: BullmqQueueLike, jobName = "notification") {
        this.#queue = queue;
        this.#jobName = jobName;
    }

    public async enqueue(message: NotificationMessage, options?: { scheduledAt?: number }): Promise<string> {
        let delay: number | undefined;

        if (options?.scheduledAt !== undefined) {
            delay = Math.max(0, options.scheduledAt - Date.now());
        }

        const job = await this.#queue.add(this.#jobName, message, delay === undefined ? undefined : { delay });

        return job.id ?? "";
    }

    public async reserve(): Promise<QueueJob | undefined> {
        const token = `notification-${String(Date.now())}`;
        const job = await this.#queue.getNextJob(token);

        if (!job) {
            return undefined;
        }

        return { attempts: job.attemptsMade + 1, id: job.id ?? "", message: job.data as NotificationMessage, scheduledAt: 0 };
    }

    public async ack(id: string): Promise<void> {
        const job = await this.#queue.getJob(id);

        if (job) {
            await job.remove();
        }
    }

    public async retry(id: string, delayMs = 0): Promise<void> {
        const job = await this.#queue.getJob(id);

        if (!job) {
            return;
        }

        await job.moveToDelayed(Date.now() + delayMs);
    }

    public async size(): Promise<number> {
        return await this.#queue.count();
    }
}

/**
 * Convenience factory for {@link BullMqQueue}.
 * @param queue A configured BullMQ `Queue` instance (optional peer).
 * @param jobName The name jobs are enqueued under.
 * @returns A new {@link BullMqQueue}.
 */
export const createBullMqQueue = (queue: BullmqQueueLike, jobName?: string): BullMqQueue => new BullMqQueue(queue, jobName);

export type { BullmqJobLike, BullmqQueueLike };
