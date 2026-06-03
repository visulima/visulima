import type { EmailOptions } from "../types";
import type { EmailQueue, EnqueueOptions, QueueJob } from "./types";

/**
 * The subset of the `@aws-sdk/client-sqs` `SQS` client this adapter uses. The `SQS` class (not the
 * lower-level `SQSClient`) exposes these operation methods directly.
 */
interface SqsClientLike {
    changeMessageVisibility: (input: { QueueUrl: string; ReceiptHandle: string; VisibilityTimeout: number }) => Promise<unknown>;
    deleteMessage: (input: { QueueUrl: string; ReceiptHandle: string }) => Promise<unknown>;
    getQueueAttributes: (input: { AttributeNames: string[]; QueueUrl: string }) => Promise<{ Attributes?: Record<string, string> }>;
    receiveMessage: (input: {
        AttributeNames?: string[];
        MaxNumberOfMessages?: number;
        QueueUrl: string;
        VisibilityTimeout?: number;
        WaitTimeSeconds?: number;
    }) => Promise<{ Messages?: { Attributes?: Record<string, string>; Body?: string; MessageId?: string; ReceiptHandle?: string }[] }>;
    sendMessage: (input: { DelaySeconds?: number; MessageBody: string; QueueUrl: string }) => Promise<{ MessageId?: string }>;
}

/**
 * Options for {@link createSqsQueue}.
 */
interface SqsQueueOptions {
    /**
     * The SQS queue URL.
     */
    queueUrl: string;

    /**
     * Visibility timeout (seconds) applied when reserving a message.
     * @default 30
     */
    visibilityTimeout?: number;

    /**
     * Long-poll wait time (seconds) for `reserve`.
     * @default 0
     */
    waitTimeSeconds?: number;
}

// SQS allows a maximum delay of 15 minutes.
const MAX_DELAY_SECONDS = 900;

const toDelaySeconds = (scheduledAt: Date | number | undefined, now: number): number => {
    if (scheduledAt === undefined) {
        return 0;
    }

    const target = scheduledAt instanceof Date ? scheduledAt.getTime() : scheduledAt;
    const seconds = Math.ceil((target - now) / 1000);

    return Math.min(MAX_DELAY_SECONDS, Math.max(0, seconds));
};

/**
 * An {@link EmailQueue} backed by Amazon SQS, which maps natively onto the reserve/ack/retry model
 * (ReceiveMessage / DeleteMessage / ChangeMessageVisibility).
 *
 * Pass an `@aws-sdk/client-sqs` `SQS` instance (an optional peer). The reserved job `id` is the SQS
 * `ReceiptHandle`. `scheduledAt` is honored up to the SQS 15-minute delay limit.
 */
class SqsQueue implements EmailQueue {
    private readonly client: SqsClientLike;

    private readonly queueUrl: string;

    private readonly visibilityTimeout: number;

    private readonly waitTimeSeconds: number;

    public constructor(client: SqsClientLike, options: SqsQueueOptions) {
        this.client = client;
        this.queueUrl = options.queueUrl;
        this.visibilityTimeout = options.visibilityTimeout ?? 30;
        this.waitTimeSeconds = options.waitTimeSeconds ?? 0;
    }

    /** Enqueues the message. */
    public async enqueue(message: EmailOptions, options: EnqueueOptions = {}): Promise<string> {
        const result = await this.client.sendMessage({
            DelaySeconds: toDelaySeconds(options.scheduledAt, Date.now()),
            MessageBody: JSON.stringify(message),
            QueueUrl: this.queueUrl,
        });

        return result.MessageId ?? "";
    }

    /** Reserves the next ready job. */
    public async reserve(): Promise<QueueJob | undefined> {
        const result = await this.client.receiveMessage({
            AttributeNames: ["ApproximateReceiveCount"],
            MaxNumberOfMessages: 1,
            QueueUrl: this.queueUrl,
            VisibilityTimeout: this.visibilityTimeout,
            WaitTimeSeconds: this.waitTimeSeconds,
        });

        const message = result.Messages?.[0];

        if (!message?.ReceiptHandle) {
            return undefined;
        }

        const receiveCount = Number(message.Attributes?.ApproximateReceiveCount ?? "1");

        return {
            attempts: Math.max(0, receiveCount - 1),
            id: message.ReceiptHandle,
            message: JSON.parse(message.Body ?? "{}") as EmailOptions,
            scheduledAt: 0,
        };
    }

    /** Acknowledges (removes) a processed job. */
    public async ack(id: string): Promise<void> {
        await this.client.deleteMessage({ QueueUrl: this.queueUrl, ReceiptHandle: id });
    }

    /** Requeues a job for another attempt. */
    public async retry(id: string, delayMs = 0): Promise<void> {
        // Making the message visible again after `delayMs` lets SQS redeliver it.
        await this.client.changeMessageVisibility({
            QueueUrl: this.queueUrl,
            ReceiptHandle: id,
            VisibilityTimeout: Math.min(MAX_DELAY_SECONDS, Math.max(0, Math.ceil(delayMs / 1000))),
        });
    }

    /** Returns the number of queued jobs. */
    public async size(): Promise<number> {
        const result = await this.client.getQueueAttributes({
            AttributeNames: ["ApproximateNumberOfMessages"],
            QueueUrl: this.queueUrl,
        });

        return Number(result.Attributes?.ApproximateNumberOfMessages ?? 0);
    }
}

/**
 * Creates an {@link EmailQueue} backed by Amazon SQS.
 * @param client An `@aws-sdk/client-sqs` `SQS` instance (optional peer).
 * @param options Queue options. See {@link SqsQueueOptions}.
 * @returns The SQS-backed queue.
 */
const createSqsQueue = (client: SqsClientLike, options: SqsQueueOptions): EmailQueue => new SqsQueue(client, options);

export type { SqsClientLike, SqsQueueOptions };
export { createSqsQueue };
