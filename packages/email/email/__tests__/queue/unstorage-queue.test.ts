import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { describe, expect, it, vi } from "vitest";

import { createWorker } from "../../src/queue";
import type { UnstorageQueue } from "../../src/queue/unstorage-queue";
import { createUnstorageQueue } from "../../src/queue/unstorage-queue";
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

const newQueue = (now: () => number): UnstorageQueue => {
    const storage = createStorage({ driver: memoryDriver() });

    return createUnstorageQueue(storage, { now, visibilityTimeout: 100 });
};

describe("unstorage queue", () => {
    it("persists, reserves and acks a job", async () => {
        expect.assertions(3);

        const clock = 0;
        const queue = newQueue(() => clock);

        await queue.enqueue(message);

        await expect(queue.size()).resolves.toBe(1);

        const job = await queue.reserve();

        expect(job?.message.subject).toBe("Hi");

        await queue.ack(job?.id as string);

        await expect(queue.size()).resolves.toBe(0);
    });

    it("hides a reserved job until the visibility window elapses", async () => {
        expect.assertions(2);

        let clock = 0;
        const queue = newQueue(() => clock);

        await queue.enqueue(message);
        await queue.reserve();

        await expect(queue.reserve()).resolves.toBeUndefined();

        clock = 200;

        await expect(queue.reserve()).resolves.toBeDefined();
    });

    it("retry requeues with an incremented attempt and a delay", async () => {
        expect.assertions(2);

        let clock = 0;
        const queue = newQueue(() => clock);

        const id = await queue.enqueue(message);

        await queue.reserve();
        await queue.retry(id, 50);

        await expect(queue.reserve()).resolves.toBeUndefined(); // still delayed

        clock = 60;
        const retried = await queue.reserve();

        expect(retried?.attempts).toBe(1);
    });

    it("drives the standard worker to completion", async () => {
        expect.assertions(2);

        const queue = newQueue(() => 0);
        const send = vi.fn(() => Promise.resolve(okResult()));

        await queue.enqueue(message);
        await queue.enqueue(message);

        const worker = createWorker({ queue, send });

        await worker.drain();

        expect(send).toHaveBeenCalledTimes(2);
        await expect(queue.size()).resolves.toBe(0);
    });
});
