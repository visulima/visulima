import { describe, expect, it, vi } from "vitest";

import { createWorker, MemoryQueue } from "../../src/queue";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

const okResult = (): Result<EmailResult> => {
    return {
        data: { messageId: "m1", provider: "stub", sent: true, timestamp: new Date(0) },
        success: true,
    };
};

const failResult = (): Result<EmailResult> => {
    return { error: new Error("boom"), success: false };
};

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
            expect(queue.size()).toBe(0);
        });

        it("surfaces queue ack failures via onError instead of aborting the drain", async () => {
            expect.assertions(2);

            let reserved = false;
            const queue = {
                ack: () => {
                    throw new Error("store down");
                },
                enqueue: () => "j1",
                reserve: () => {
                    if (reserved) {
                        return undefined;
                    }

                    reserved = true;

                    return { attempts: 0, id: "j1", message, scheduledAt: 0 };
                },
                retry: () => undefined,
                size: () => 1,
            };
            const onError = vi.fn();
            const send = vi.fn(() => Promise.resolve(okResult()));

            const worker = createWorker({ onError, queue, send });

            // The ack rejection must be caught (not abort drain) and reported via onError.
            await expect(worker.drain()).resolves.toBeUndefined();
            expect(onError).toHaveBeenCalledTimes(1);
        });

        it("retries failures and dead-letters after maxAttempts", async () => {
            expect.assertions(2);

            const clock = 0;
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

        it("acks a successful job so it is not re-delivered", async () => {
            expect.assertions(2);

            const queue = new MemoryQueue();
            const send = vi.fn(() => Promise.resolve(okResult()));

            queue.enqueue(message);

            const worker = createWorker({ queue, send });

            await worker.drain();
            // A second drain finds nothing to do because the job was acked (removed).
            await worker.drain();

            expect(send).toHaveBeenCalledTimes(1);
            expect(queue.size()).toBe(0);
        });

        it("reports a failed attempt via onError before retrying", async () => {
            expect.assertions(2);

            const clock = 0;
            const queue = new MemoryQueue({ now: () => clock });
            const send = vi.fn<() => Promise<Result<EmailResult>>>().mockResolvedValueOnce(failResult()).mockResolvedValue(okResult());
            const onError = vi.fn();

            queue.enqueue(message);

            const worker = createWorker({ backoff: () => 0, maxAttempts: 3, onError, queue, send });

            await worker.drain(); // first attempt fails → onError + retry
            await worker.drain(); // retry succeeds → acked

            expect(onError).toHaveBeenCalledTimes(1);
            expect(queue.size()).toBe(0);
        });

        it("stops claiming new jobs after stop()", async () => {
            expect.assertions(1);

            const queue = new MemoryQueue();
            const send = vi.fn(() => Promise.resolve(okResult()));

            queue.enqueue(message);

            const worker = createWorker({ pollInterval: 5, queue, send });

            worker.start();
            worker.stop(); // stop immediately

            // Enqueue more work after stop; the worker must not pick it up.
            queue.enqueue(message);
            queue.enqueue(message);

            await new Promise((resolve) => {
                setTimeout(resolve, 50);
            });

            // The worker is stopped, so the two post-stop jobs stay in the queue.
            expect(queue.size()).toBeGreaterThanOrEqual(2);
        });

        it("does not double-claim a job across concurrent workers", async () => {
            expect.assertions(2);

            const queue = new MemoryQueue({ visibilityTimeout: 30_000 });
            const seen = new Set<string>();
            let duplicate = false;
            const send = vi.fn((options: EmailOptions) => {
                const key = options.subject;

                if (seen.has(key)) {
                    duplicate = true;
                }

                seen.add(key);

                return Promise.resolve(okResult());
            });

            for (let index = 0; index < 5; index += 1) {
                queue.enqueue({ ...message, subject: `job-${String(index)}` });
            }

            const worker = createWorker({ concurrency: 3, queue, send });

            // Two concurrent drains share the same queue; reservation visibility must prevent
            // the same job being handed to both.
            await Promise.all([worker.drain(), worker.drain()]);

            expect(duplicate).toBe(false);
            expect(queue.size()).toBe(0);
        });
    });
});
