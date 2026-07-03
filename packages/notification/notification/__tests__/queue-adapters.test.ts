import { describe, expect, it, vi } from "vitest";

import type { NotificationMessage } from "../src/notification";
import { BullMqQueue, createBullMqQueue } from "../src/queue/bullmq-queue";
import { createPgBossQueue, PgBossQueue } from "../src/queue/pg-boss-queue";
import { createSqsQueue, SqsQueue } from "../src/queue/sqs-queue";

const message: NotificationMessage = { sms: { text: "hi", to: "+1" } };

describe("bullMqQueue", () => {
    it("enqueue adds a job and returns its id", async () => {
        expect.assertions(2);

        const add = vi.fn().mockResolvedValue({ id: "job-1" });
        const queue = createBullMqQueue({ add } as never);

        const id = await queue.enqueue(message);

        expect(id).toBe("job-1");
        expect(add).toHaveBeenCalledWith("notification", message, undefined);
    });

    it("enqueue maps scheduledAt to a bullmq delay", async () => {
        expect.assertions(1);

        const add = vi.fn().mockResolvedValue({ id: "job-2" });
        const queue = new BullMqQueue({ add } as never);

        await queue.enqueue(message, { scheduledAt: Date.now() + 5000 });

        expect((add.mock.calls[0]?.[2] as { delay: number }).delay).toBeGreaterThan(0);
    });

    it("reserve fetches the next job", async () => {
        expect.assertions(2);

        const getNextJob = vi.fn().mockResolvedValue({ attemptsMade: 0, data: message, id: "job-3" });
        const queue = new BullMqQueue({ getNextJob } as never);

        const job = await queue.reserve();

        expect(getNextJob).toHaveBeenCalledTimes(1);
        expect(job).toStrictEqual({ attempts: 1, id: "job-3", message, scheduledAt: 0 });
    });

    it("ack removes the job", async () => {
        expect.assertions(1);

        const remove = vi.fn().mockResolvedValue(undefined);
        const getJob = vi.fn().mockResolvedValue({ remove });
        const queue = new BullMqQueue({ getJob } as never);

        await queue.ack("job-4");

        expect(remove).toHaveBeenCalledTimes(1);
    });

    it("size delegates to count", async () => {
        expect.assertions(1);

        const count = vi.fn().mockResolvedValue(7);
        const queue = new BullMqQueue({ count } as never);

        await expect(queue.size()).resolves.toBe(7);
    });
});

describe("pgBossQueue", () => {
    it("enqueue sends to the named queue", async () => {
        expect.assertions(2);

        const send = vi.fn().mockResolvedValue("pg-1");
        const queue = createPgBossQueue({ send } as never, { queueName: "notify" });

        const id = await queue.enqueue(message);

        expect(id).toBe("pg-1");
        expect(send).toHaveBeenCalledWith("notify", message, {});
    });

    it("reserve fetches a job with metadata", async () => {
        expect.assertions(2);

        const fetch = vi.fn().mockResolvedValue([{ data: message, id: "pg-2", retryCount: 2 }]);
        const queue = new PgBossQueue({ fetch } as never, { queueName: "notify" });

        const job = await queue.reserve();

        expect(fetch).toHaveBeenCalledWith("notify", { batchSize: 1, includeMetadata: true });
        expect(job).toStrictEqual({ attempts: 2, id: "pg-2", message, scheduledAt: 0 });
    });

    it("ack completes the job", async () => {
        expect.assertions(1);

        const complete = vi.fn().mockResolvedValue(undefined);
        const queue = new PgBossQueue({ complete } as never, { queueName: "notify" });

        await queue.ack("pg-3");

        expect(complete).toHaveBeenCalledWith("notify", "pg-3");
    });

    it("retry fails the job per the queue retry policy", async () => {
        expect.assertions(1);

        const fail = vi.fn().mockResolvedValue(undefined);
        const queue = new PgBossQueue({ fail } as never, { queueName: "notify" });

        await queue.retry("pg-4");

        expect(fail).toHaveBeenCalledWith("notify", "pg-4");
    });
});

describe("sqsQueue", () => {
    it("enqueue sends a message and returns its id", async () => {
        expect.assertions(2);

        const sendMessage = vi.fn().mockResolvedValue({ MessageId: "sqs-1" });
        const queue = createSqsQueue({ sendMessage } as never, { queueUrl: "url" });

        const id = await queue.enqueue(message);

        expect(id).toBe("sqs-1");
        expect(sendMessage).toHaveBeenCalledWith({ DelaySeconds: 0, MessageBody: JSON.stringify(message), QueueUrl: "url" });
    });

    it("enqueue rejects delays beyond the SQS limit", async () => {
        expect.assertions(1);

        const sendMessage = vi.fn();
        const queue = new SqsQueue({ sendMessage } as never, { queueUrl: "url" });

        await expect(queue.enqueue(message, { scheduledAt: Date.now() + 1000 * 60 * 60 })).rejects.toThrow(RangeError);
    });

    it("reserve receives and parses the next message", async () => {
        expect.assertions(2);

        const receiveMessage = vi.fn().mockResolvedValue({
            Messages: [{ Attributes: { ApproximateReceiveCount: "1" }, Body: JSON.stringify(message), ReceiptHandle: "rh-1" }],
        });
        const queue = new SqsQueue({ receiveMessage } as never, { queueUrl: "url" });

        const job = await queue.reserve();

        expect(receiveMessage).toHaveBeenCalledTimes(1);
        expect(job).toStrictEqual({ attempts: 0, id: "rh-1", message, scheduledAt: 0 });
    });

    it("ack deletes the message by receipt handle", async () => {
        expect.assertions(1);

        const deleteMessage = vi.fn().mockResolvedValue(undefined);
        const queue = new SqsQueue({ deleteMessage } as never, { queueUrl: "url" });

        await queue.ack("rh-2");

        expect(deleteMessage).toHaveBeenCalledWith({ QueueUrl: "url", ReceiptHandle: "rh-2" });
    });

    it("size sums ready and in-flight counts", async () => {
        expect.assertions(1);

        const getQueueAttributes = vi.fn().mockResolvedValue({
            Attributes: { ApproximateNumberOfMessages: "3", ApproximateNumberOfMessagesNotVisible: "2" },
        });
        const queue = new SqsQueue({ getQueueAttributes } as never, { queueUrl: "url" });

        await expect(queue.size()).resolves.toBe(5);
    });
});
