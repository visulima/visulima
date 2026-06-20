import { afterEach, describe, expect, it, vi } from "vitest";

import { createNotification } from "../src/notification";
import { mockProvider } from "../src/providers/mock";
import { createQueueWorker, MemoryQueue } from "../src/queue";

describe(createQueueWorker, () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("drain processes all due jobs then resolves", async () => {
        expect.assertions(2);

        const provider = mockProvider({ channel: "sms" });
        const notify = createNotification({ sms: provider });
        const queue = new MemoryQueue();

        queue.enqueue({ sms: { text: "1", to: "+1" } });
        queue.enqueue({ sms: { text: "2", to: "+2" } });

        await createQueueWorker(queue, notify).drain();

        expect(queue.size()).toBe(0);
        expect(provider.getInstance?.().sent).toHaveLength(2);
    });

    it("retries a failing job with backoff up to maxAttempts then drops it", async () => {
        expect.assertions(4);

        vi.useFakeTimers();
        vi.setSystemTime(0);

        const provider = mockProvider({ channel: "sms", failWith: "boom" });
        const notify = createNotification({ sms: provider });
        const queue = new MemoryQueue();
        const onDrop = vi.fn();

        queue.enqueue({ sms: { text: "x", to: "+1" } });

        const backoff = vi.fn((attempt: number) => attempt * 1000);
        const worker = createQueueWorker(queue, notify, { backoff, maxAttempts: 2, onDrop });

        // attempt 1 -> fail -> retry scheduled at now + backoff(1) = 1000
        await worker.drain();

        expect(onDrop).not.toHaveBeenCalled();
        expect(queue.size()).toBe(1);

        // Job is not yet due; drain finds nothing.
        await worker.drain();

        expect(onDrop).not.toHaveBeenCalled();

        // Advance past the backoff: attempt 2 reaches maxAttempts -> dropped.
        vi.setSystemTime(2000);
        await worker.drain();

        expect(onDrop).toHaveBeenCalledTimes(1);
    });

    it("start toggles the loop on and stop turns it off", async () => {
        expect.assertions(2);

        vi.useFakeTimers();

        const provider = mockProvider({ channel: "sms" });
        const notify = createNotification({ sms: provider });
        const queue = new MemoryQueue();

        queue.enqueue({ sms: { text: "1", to: "+1" } });

        const worker = createQueueWorker(queue, notify, { pollInterval: 50 });

        worker.start();
        await vi.advanceTimersByTimeAsync(0);

        expect(provider.getInstance?.().sent).toHaveLength(1);

        worker.stop();

        // After stopping, newly enqueued jobs are not processed.
        queue.enqueue({ sms: { text: "2", to: "+2" } });
        await vi.advanceTimersByTimeAsync(200);

        expect(provider.getInstance?.().sent).toHaveLength(1);
    });
});
