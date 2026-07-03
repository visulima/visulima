import type { EmailOptions, EmailResult, Result } from "../types";
import type { EnqueueOptions } from "./types";

/**
 * The subset of a [BullMQ](https://docs.bullmq.io/) `Queue` this adapter uses.
 */
export interface BullmqQueueLike {
    add: (name: string, data: unknown, options?: { delay?: number }) => Promise<{ id?: string }>;
}

/**
 * A BullMQ job, narrowed to its `data` payload.
 */
export interface BullmqJobLike {
    data: EmailOptions;
}

/**
 * A BullMQ `Worker` processor that sends a job's message and resolves with the send result.
 */
export type BullmqProcessor = (job: BullmqJobLike) => Promise<EmailResult>;

/**
 * Adds a message to a BullMQ queue.
 *
 * BullMQ is push-based — jobs are consumed by a BullMQ `Worker`, not the pull-based reserve/ack model
 * of `EmailQueue`. Use this to enqueue and {@link createBullmqProcessor} to consume.
 * @param queue A BullMQ `Queue` instance to add the job to (optional peer).
 * @param message The email payload stored as the BullMQ job data.
 * @param options Optional scheduling — `scheduledAt` maps to a BullMQ `delay`.
 * @param jobName The name to enqueue the job under.
 * @returns The id of the created BullMQ job.
 */
export const enqueueToBullmq = async (queue: BullmqQueueLike, message: EmailOptions, options: EnqueueOptions = {}, jobName = "email"): Promise<string> => {
    let delay: number | undefined;

    if (options.scheduledAt !== undefined) {
        const target = options.scheduledAt instanceof Date ? options.scheduledAt.getTime() : options.scheduledAt;

        delay = Math.max(0, target - Date.now());
    }

    const job = await queue.add(jobName, message, delay === undefined ? undefined : { delay });

    return job.id ?? "";
};

/**
 * Builds a BullMQ `Worker` processor that sends each job's message via the given send function.
 *
 * Pass it to `new Worker(queueName, createBullmqProcessor(mail.send.bind(mail)), { concurrency })`.
 * BullMQ then handles concurrency, retries (via the job's `attempts`/`backoff`) and dead-lettering. A
 * failed send throws so BullMQ records the attempt.
 * @param send The send function — typically `mail.send.bind(mail)`.
 * @returns A BullMQ processor function.
 */
export const createBullmqProcessor
    = (send: (message: EmailOptions) => Promise<Result<EmailResult>>): BullmqProcessor =>
        async (job: BullmqJobLike): Promise<EmailResult> => {
            const result = await send(job.data);

            if (!result.success || !result.data) {
                throw result.error instanceof Error ? result.error : new Error("Email send failed");
            }

            return result.data;
        };
