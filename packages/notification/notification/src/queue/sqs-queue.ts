import type { NotificationMessage } from "../notification";
import type { NotificationQueue, QueueJob } from "./types";

// SQS allows a maximum delay of 15 minutes.
const MAX_DELAY_SECONDS = 900;

const ATTR_READY = "ApproximateNumberOfMessages";

// eslint-disable-next-line no-secrets/no-secrets -- SQS attribute name, not a secret
const ATTR_IN_FLIGHT = "ApproximateNumberOfMessagesNotVisible";

/**
 * A single SQS message, narrowed to the members this adapter reads.
 */
interface SqsMessageLike {
    Attributes?: Record<string, string>;
    Body?: string;
    ReceiptHandle?: string;
}

/**
 * The subset of the high-level `@aws-sdk/client-sqs` `SQS` operations this adapter uses. The `SQS`
 * class exposes these operation methods directly (unlike the command-based `SQSClient.send`), keeping
 * the adapter mockable with plain method stubs and avoiding an import of the optional peer.
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
    }) => Promise<{ Messages?: SqsMessageLike[] }>;
    sendMessage: (input: { DelaySeconds?: number; MessageBody: string; QueueUrl: string }) => Promise<{ MessageId?: string }>;
}

const toDelaySeconds = (scheduledAt: number | undefined, now: number): number => {
    if (scheduledAt === undefined) {
        return 0;
    }

    const seconds = Math.ceil((scheduledAt - now) / 1000);

    return Math.max(0, seconds);
};

/**
 * Options for {@link createSqsQueue}.
 */
export interface SqsQueueOptions {
    /** The SQS queue URL. */
    queueUrl: string;

    /** Visibility timeout (seconds) applied when reserving a message (default 30). */
    visibilityTimeout?: number;

    /** Long-poll wait time (seconds) for `reserve` (default 0). */
    waitTimeSeconds?: number;
}

/**
 * A {@link NotificationQueue} backed by Amazon SQS, which maps natively onto the reserve/ack/retry
 * model (ReceiveMessage / DeleteMessage / ChangeMessageVisibility).
 *
 * Pass an `@aws-sdk/client-sqs` `SQS` instance — it is an optional peer dependency and is never
 * constructed here. The reserved job `id` is the SQS `ReceiptHandle`. `scheduledAt` is honored up to
 * the SQS 15-minute delay limit.
 *
 * Runtime: NODE ONLY (depends on the AWS SDK). Not Cloudflare Workers compatible.
 */
export class SqsQueue implements NotificationQueue {
    readonly #client: SqsClientLike;

    readonly #queueUrl: string;

    readonly #visibilityTimeout: number;

    readonly #waitTimeSeconds: number;

    public constructor(client: SqsClientLike, options: SqsQueueOptions) {
        this.#client = client;
        this.#queueUrl = options.queueUrl;
        this.#visibilityTimeout = options.visibilityTimeout ?? 30;
        this.#waitTimeSeconds = options.waitTimeSeconds ?? 0;
    }

    public async enqueue(message: NotificationMessage, options?: { scheduledAt?: number }): Promise<string> {
        const delaySeconds = toDelaySeconds(options?.scheduledAt, Date.now());

        if (delaySeconds > MAX_DELAY_SECONDS) {
            // SQS caps native delays at 15 minutes; clamping would deliver far-future jobs early.
            throw new RangeError(`SQS supports a maximum scheduling delay of ${String(MAX_DELAY_SECONDS)}s (15 minutes); use a scheduler for longer delays`);
        }

        const result = await this.#client.sendMessage({ DelaySeconds: delaySeconds, MessageBody: JSON.stringify(message), QueueUrl: this.#queueUrl });

        return result.MessageId ?? "";
    }

    public async reserve(): Promise<QueueJob | undefined> {
        const result = await this.#client.receiveMessage({
            AttributeNames: ["ApproximateReceiveCount"],
            MaxNumberOfMessages: 1,
            QueueUrl: this.#queueUrl,
            VisibilityTimeout: this.#visibilityTimeout,
            WaitTimeSeconds: this.#waitTimeSeconds,
        });

        const message = result.Messages?.[0];

        if (!message?.ReceiptHandle) {
            return undefined;
        }

        const receiveCount = Number(message.Attributes?.ApproximateReceiveCount ?? "1");

        let parsed: NotificationMessage;

        try {
            parsed = JSON.parse(message.Body ?? "{}") as NotificationMessage;
        } catch {
            // Drop a poison (non-JSON) message so polling continues instead of stalling.
            await this.#client.deleteMessage({ QueueUrl: this.#queueUrl, ReceiptHandle: message.ReceiptHandle });

            return undefined;
        }

        return { attempts: Math.max(1, receiveCount), id: message.ReceiptHandle, message: parsed, scheduledAt: 0 };
    }

    public async ack(id: string): Promise<void> {
        await this.#client.deleteMessage({ QueueUrl: this.#queueUrl, ReceiptHandle: id });
    }

    public async retry(id: string, delayMs = 0): Promise<void> {
        // Making the message visible again after `delayMs` lets SQS redeliver it.
        await this.#client.changeMessageVisibility({
            QueueUrl: this.#queueUrl,
            ReceiptHandle: id,
            VisibilityTimeout: Math.min(MAX_DELAY_SECONDS, Math.max(0, Math.ceil(delayMs / 1000))),
        });
    }

    public async size(): Promise<number> {
        const result = await this.#client.getQueueAttributes({ AttributeNames: [ATTR_READY, ATTR_IN_FLIGHT], QueueUrl: this.#queueUrl });

        return Number(result.Attributes?.[ATTR_READY] ?? 0) + Number(result.Attributes?.[ATTR_IN_FLIGHT] ?? 0);
    }
}

/**
 * Convenience factory for {@link SqsQueue}.
 * @param client An `@aws-sdk/client-sqs` `SQS` instance (optional peer).
 * @param options Queue options. See {@link SqsQueueOptions}.
 * @returns A new {@link SqsQueue}.
 */
export const createSqsQueue = (client: SqsClientLike, options: SqsQueueOptions): SqsQueue => new SqsQueue(client, options);

export type { SqsClientLike, SqsMessageLike };
