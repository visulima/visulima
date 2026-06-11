import { describe, expect, it, vi } from "vitest";

import { createBullmqProcessor, enqueueToBullmq } from "../../src/queue/bullmq-queue";
import { createPgBossQueue } from "../../src/queue/pg-boss-queue";
import { createSqsQueue } from "../../src/queue/sqs-queue";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

const message: EmailOptions = {
    from: { email: "from@x.com" },
    subject: "Hi",
    text: "body",
    to: { email: "to@x.com" },
};

const okResult = (): Result<EmailResult> => {
    return {
        data: { messageId: "m1", provider: "stub", sent: true, timestamp: new Date(0) },
        success: true,
    };
};

describe("queue adapters", () => {
    describe(createSqsQueue, () => {
        it("maps enqueue/reserve/ack/retry/size onto SQS operations", async () => {
            expect.assertions(6);

            const client = {
                changeMessageVisibility: vi.fn(() => Promise.resolve({})),
                deleteMessage: vi.fn(() => Promise.resolve({})),
                getQueueAttributes: vi.fn(() => Promise.resolve({ Attributes: { ApproximateNumberOfMessages: "4" } })),
                receiveMessage: vi.fn(() =>
                    Promise.resolve({ Messages: [{ Attributes: { ApproximateReceiveCount: "2" }, Body: JSON.stringify(message), ReceiptHandle: "rh-1" }] }),
                ),
                sendMessage: vi.fn(() => Promise.resolve({ MessageId: "msg-1" })),
            };
            const queue = createSqsQueue(client, { queueUrl: "https://sqs/q", visibilityTimeout: 60 });

            await expect(queue.enqueue(message)).resolves.toBe("msg-1");

            const job = await queue.reserve();

            expect(job?.id).toBe("rh-1");
            expect(job?.attempts).toBe(1); // ApproximateReceiveCount 2 → 1 prior attempt

            await queue.retry("rh-1", 5000);

            expect(client.changeMessageVisibility).toHaveBeenCalledWith({ QueueUrl: "https://sqs/q", ReceiptHandle: "rh-1", VisibilityTimeout: 5 });

            await queue.ack("rh-1");

            expect(client.deleteMessage).toHaveBeenCalledWith({ QueueUrl: "https://sqs/q", ReceiptHandle: "rh-1" });
            await expect(queue.size()).resolves.toBe(4);
        });
    });

    describe(createPgBossQueue, () => {
        it("maps enqueue/reserve/ack/retry/size onto pg-boss methods", async () => {
            expect.assertions(5);

            const boss = {
                complete: vi.fn(() => Promise.resolve({})),
                fail: vi.fn(() => Promise.resolve({})),
                fetch: vi.fn(() => Promise.resolve([{ data: message, id: "job-1" }])),
                getQueueSize: vi.fn(() => Promise.resolve(7)),
                send: vi.fn(() => Promise.resolve("job-1")),
            };
            const queue = createPgBossQueue(boss, { queueName: "emails" });

            await expect(queue.enqueue(message)).resolves.toBe("job-1");

            const job = await queue.reserve();

            expect(job?.message.subject).toBe("Hi");

            await queue.retry("job-1");

            expect(boss.fail).toHaveBeenCalledWith("emails", "job-1");

            await queue.ack("job-1");

            expect(boss.complete).toHaveBeenCalledWith("emails", "job-1");
            await expect(queue.size()).resolves.toBe(7);
        });
    });

    describe("bullmq bridge", () => {
        it("enqueues with a computed delay", async () => {
            expect.assertions(2);

            const queue = { add: vi.fn(() => Promise.resolve({ id: "bq-1" })) };

            const id = await enqueueToBullmq(queue, message);

            expect(id).toBe("bq-1");
            expect(queue.add).toHaveBeenCalledWith("email", message, undefined);
        });

        it("createBullmqProcessor sends and throws on failure", async () => {
            expect.assertions(2);

            const ok = createBullmqProcessor(() => Promise.resolve(okResult()));

            await expect(ok({ data: message })).resolves.toStrictEqual(okResult().data);

            const failing = createBullmqProcessor(() => Promise.resolve({ error: new Error("boom"), success: false }));

            await expect(failing({ data: message })).rejects.toThrow("boom");
        });
    });
});
