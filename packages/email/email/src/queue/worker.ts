import type { EmailOptions, EmailResult, Result } from "../types";
import type { EmailQueue, QueueJob } from "./types";

const defaultBackoff = (attempts: number): number => 1000 * 2 ** (attempts - 1);

/**
 * Options for {@link createWorker}.
 */
export interface WorkerOptions {
    /**
     * Retry backoff: returns the delay (ms) before re-attempting after `attempts` failures.
     * @default attempts => 1000 * 2 ** (attempts - 1)
     */
    backoff?: (attempts: number) => number;

    /**
     * How many jobs to process concurrently.
     * @default 1
     */
    concurrency?: number;

    /**
     * Maximum delivery attempts before a job is dead-lettered.
     * @default 3
     */
    maxAttempts?: number;

    /**
     * Called when a job exhausts its attempts and is dropped.
     * @param job The dead-lettered job.
     * @param result The final failed result.
     */
    onDeadLetter?: (job: QueueJob, result: Result<EmailResult>) => void;

    /**
     * Called on every failed attempt (before any retry).
     * @param job The job that failed.
     * @param result The failed result (or thrown error wrapped).
     */
    onError?: (job: QueueJob, result: Result<EmailResult>) => void;

    /**
     * Idle poll interval, in milliseconds, when no job is ready.
     * @default 1000
     */
    pollInterval?: number;

    /**
     * The queue to consume.
     */
    queue: EmailQueue;

    /**
     * The send function — typically `mail.send.bind(mail)`.
     */
    send: (message: EmailOptions) => Promise<Result<EmailResult>>;
}

/**
 * A running queue worker.
 */
export interface Worker {
    /**
     * Processes ready jobs until the queue has none currently deliverable, then resolves.
     *
     * Does not wait for future-scheduled jobs. Useful in tests and one-shot drains.
     */
    drain: () => Promise<void>;

    /**
     * Begins polling and processing jobs in the background.
     */
    start: () => void;

    /**
     * Stops polling. In-flight jobs are allowed to finish.
     */
    stop: () => void;
}

/**
 * Creates a worker that durably processes queued messages with bounded concurrency, retry/backoff, and
 * dead-lettering.
 * @param options Worker configuration. See {@link WorkerOptions}.
 * @returns The worker handle. See {@link Worker}.
 * @example
 * ```ts
 * const queue = new MemoryQueue();
 * const worker = createWorker({ queue, send: mail.send.bind(mail), concurrency: 5 });
 * worker.start();
 * ```
 */
export const createWorker = (options: WorkerOptions): Worker => {
    const { backoff = defaultBackoff, concurrency = 1, maxAttempts = 3, onDeadLetter, onError, pollInterval = 1000, queue, send } = options;

    let running = false;
    let active = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const processJob = async (job: QueueJob): Promise<void> => {
        let result: Result<EmailResult>;

        try {
            result = await send(job.message);
        } catch (error) {
            result = { error: error instanceof Error ? error : new Error(String(error)), success: false };
        }

        if (result.success) {
            await queue.ack(job.id);

            return;
        }

        onError?.(job, result);

        const attemptsMade = job.attempts + 1;

        if (attemptsMade >= maxAttempts) {
            await queue.ack(job.id);
            onDeadLetter?.(job, result);

            return;
        }

        await queue.retry(job.id, backoff(attemptsMade));
    };

    const tick = async (): Promise<void> => {
        if (!running) {
            return;
        }

        while (active < concurrency) {
            // eslint-disable-next-line no-await-in-loop
            const job = await queue.reserve();

            if (!job) {
                break;
            }

            active += 1;

            processJob(job)
                .finally(() => {
                    active -= 1;
                })
                .catch(() => undefined);
        }

        // `running` may have been flipped by stop() during an awaited reserve() above.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (running) {
            timer = setTimeout(() => {
                tick().catch(() => undefined);
            }, pollInterval);
        }
    };

    return {
        drain: async () => {
            let job = await queue.reserve();

            while (job) {
                // eslint-disable-next-line no-await-in-loop
                await processJob(job);
                // eslint-disable-next-line no-await-in-loop
                job = await queue.reserve();
            }
        },
        start: () => {
            if (running) {
                return;
            }

            running = true;
            tick().catch(() => undefined);
        },
        stop: () => {
            running = false;

            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
        },
    };
};
