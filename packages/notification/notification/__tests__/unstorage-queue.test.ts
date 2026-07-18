import { createStorage } from "unstorage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationMessage } from "../src/notification";
import type { UnstorageQueue } from "../src/queue/unstorage-queue";
import { createUnstorageQueue } from "../src/queue/unstorage-queue";

const message: NotificationMessage = { sms: { text: "hi", to: "+1" } };

describe("unstorageQueue", () => {
    let queue: UnstorageQueue;

    beforeEach(() => {
        queue = createUnstorageQueue(createStorage());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("round-trips enqueue -> reserve -> ack", async () => {
        expect.assertions(4);

        const id = await queue.enqueue(message);

        await expect(queue.size()).resolves.toBe(1);

        const job = await queue.reserve();

        expect(job?.id).toBe(id);
        expect(job?.message).toStrictEqual(message);

        await queue.ack(id);

        await expect(queue.size()).resolves.toBe(0);
    });

    it("returns undefined from reserve when empty", async () => {
        expect.assertions(1);

        await expect(queue.reserve()).resolves.toBeUndefined();
    });

    it("does not lose jobs enqueued concurrently", async () => {
        expect.assertions(1);

        await Promise.all([
            queue.enqueue({ sms: { text: "1", to: "+1" } }),
            queue.enqueue({ sms: { text: "2", to: "+2" } }),
            queue.enqueue({ sms: { text: "3", to: "+3" } }),
        ]);

        await expect(queue.size()).resolves.toBe(3);
    });

    it("marks a reserved job so a second reserve skips it", async () => {
        expect.assertions(2);

        await queue.enqueue(message);

        const first = await queue.reserve();

        expect(first?.message).toStrictEqual(message);

        await expect(queue.reserve()).resolves.toBeUndefined();
    });

    it("increments attempts on each reserve", async () => {
        expect.assertions(2);

        const id = await queue.enqueue(message);

        const first = await queue.reserve();

        expect(first?.attempts).toBe(1);

        await queue.retry(id, 0);

        const second = await queue.reserve();

        expect(second?.attempts).toBe(2);
    });

    it("does not reserve a job scheduled in the future until it is due", async () => {
        expect.assertions(3);

        vi.useFakeTimers();
        vi.setSystemTime(0);

        await queue.enqueue(message, { scheduledAt: 10_000 });

        await expect(queue.reserve()).resolves.toBeUndefined();
        await expect(queue.size()).resolves.toBe(1);

        vi.setSystemTime(10_001);

        const job = await queue.reserve();

        expect(job?.message).toStrictEqual(message);
    });

    it("retry re-queues a job for later delivery", async () => {
        expect.assertions(3);

        vi.useFakeTimers();
        vi.setSystemTime(0);

        const id = await queue.enqueue(message);

        await queue.reserve();

        await expect(queue.size()).resolves.toBe(0);

        await queue.retry(id, 5000);

        await expect(queue.reserve()).resolves.toBeUndefined();

        vi.setSystemTime(5001);

        const due = await queue.reserve();

        expect(due?.id).toBe(id);
    });
});
