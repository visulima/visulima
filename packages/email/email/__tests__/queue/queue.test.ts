import { describe, expect, it, vi } from "vitest";

import { createWorker, MemoryQueue } from "../../src/queue";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

const okResult = (): Result<EmailResult> => ({
    data: { messageId: "m1", provider: "stub", sent: true, timestamp: new Date(0) },
    success: true,
});

const failResult = (): Result<EmailResult> => ({ error: new Error("boom"), success: false });

const message: EmailOptions = {
    from: { email: "from@x.com" },
    subject: "Hi",
    text: "body",
    to: { email: "to@x.com" },
};

describe("queue", () => {
    describe(MemoryQueue, () => {
        it("reserves ready jobs and hides them within the visibility window", () => {
            expect.assertions(3);

            let clock = 0;
            const queue = new MemoryQueue({ now: () => clock, visibilityTimeout: 100 });

            queue.enqueue(message);

            const first = queue.reserve();

            expect(first).toBeDefined();
            // Still reserved → not handed out again.
            expect(queue.reserve()).toBeUndefined();

            clock = 200; // visibility window elapsed
            expect(queue.reserve()).toBeDefined();
        });

        it("does not deliver future-scheduled jobs early", () => {
            expect.assertions(2);

            let clock = 0;
            const queue = new MemoryQueue({ now: () => clock });

            queue.enqueue(message, { scheduledAt: 5000 });

            expect(queue.reserve()).toBeUndefined();

            clock = 5000;
            expect(queue.reserve()).toBeDefined();
        });

        it("ack removes a job, retry requeues it with incremented attempts", () => {
            expect.assertions(3);

            let clock = 0;
            const queue = new MemoryQueue({ now: () => clock });

            const id = queue.enqueue(message);
            const job = queue.reserve();

            queue.retry(id, 50);

            expect(queue.size()).toBe(1);
            expect(job?.attempts).toBe(0);

            clock = 50;
            const retried = queue.reserve();

            queue.ack(retried?.id as string);

            expect(queue.size()).toBe(0);
        });
    });

    describe(createWorker, () => {
        it("drains the queue, acking successful sends", async () => {
            expect.assertions(2);

            const queue = new MemoryQueue();
            const send = vi.fn(() => Promise.resolve(okResult()));

            queue.enqueue(message);
            queue.enqueue(message);

            const worker = createWorker({ queue, send });

            await worker.drain();

            expect(send).toHaveBeenCalledTimes(2);
            expect(await queue.size()).toBe(0);
        });

        it("retries failures and dead-letters after maxAttempts", async () => {
            expect.assertions(2);

            let clock = 0;
            const queue = new MemoryQueue({ now: () => clock });
            const send = vi.fn(() => Promise.resolve(failResult()));
            const onDeadLetter = vi.fn();

            queue.enqueue(message);

            const worker = createWorker({ backoff: () => 0, maxAttempts: 3, onDeadLetter, queue, send });

            // Each drain processes the currently-ready job; backoff is 0 so it is immediately ready again.
            await worker.drain();
            await worker.drain();
            await worker.drain();

            expect(send).toHaveBeenCalledTimes(3);
            expect(onDeadLetter).toHaveBeenCalledTimes(1);
        });
    });
});
