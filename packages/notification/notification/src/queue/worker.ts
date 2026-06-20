import type { Notification } from "../notification";
import type { Receipt } from "../types";
import type { NotificationQueue, QueueJob } from "./types";

const sleep = async (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

export interface QueueWorkerOptions {
    /** Backoff in ms given the attempt count (default exponential: 1s, 2s, 4s...). */
    backoff?: (attempt: number) => number;
    /** Maximum delivery attempts before a job is dropped (default 5). */
    maxAttempts?: number;
    /** Called when a job is dropped after exhausting attempts. */
    onDrop?: (job: QueueJob, receipts: Receipt[]) => void;
    /** Poll interval in ms when the queue is empty (default 1000). */
    pollInterval?: number;
}

export interface QueueWorker {
    /** Processes all currently-due jobs, then resolves. */
    drain: () => Promise<void>;
    /** Starts the polling loop. */
    start: () => void;
    /** Stops the polling loop. */
    stop: () => void;
}

/**
 * Creates a worker that reserves jobs from a queue and delivers them via a
 * {@link Notification} facade, retrying with backoff and dropping after `maxAttempts`.
 * @param queue The queue to drain.
 * @param notification The facade used to deliver messages.
 * @param options Behaviour tuning (max attempts, backoff curve, poll interval, drop hook).
 * @returns A controllable worker.
 */
export const createQueueWorker = (queue: NotificationQueue, notification: Notification, options: QueueWorkerOptions = {}): QueueWorker => {
    const maxAttempts = options.maxAttempts ?? 5;
    const pollInterval = options.pollInterval ?? 1000;
    const backoff = options.backoff ?? ((attempt: number) => Math.min(30_000, 1000 * 2 ** (attempt - 1)));

    let running = false;

    const processOne = async (): Promise<boolean> => {
        const job = await queue.reserve();

        if (!job) {
            return false;
        }

        const receipts = await notification.send(job.message);
        const failed = receipts.some((receipt) => !receipt.successful);

        if (!failed) {
            await queue.ack(job.id);
        } else if (job.attempts >= maxAttempts) {
            await queue.ack(job.id);
            options.onDrop?.(job, receipts);
        } else {
            await queue.retry(job.id, backoff(job.attempts));
        }

        return true;
    };

    const loop = async (): Promise<void> => {
        while (running) {
            // eslint-disable-next-line no-await-in-loop
            const processed = await processOne();

            if (!processed) {
                // eslint-disable-next-line no-await-in-loop
                await sleep(pollInterval);
            }
        }
    };

    return {
        drain: async () => {
            // eslint-disable-next-line no-await-in-loop
            while (await processOne()) {
                // keep draining until no due jobs remain
            }
        },
        start: () => {
            if (running) {
                return;
            }

            running = true;
            loop().catch(() => {
                running = false;
            });
        },
        stop: () => {
            running = false;
        },
    };
};
