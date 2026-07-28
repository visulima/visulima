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

    it("keeps polling after a throwing reserve and reports it via onError", async () => {
        expect.assertions(2);

        vi.useFakeTimers();

        const provider = mockProvider({ channel: "sms" });
        const notify = createNotification({ sms: provider });
        const onError = vi.fn();

        const job = { attempts: 1, id: "j1", message: { sms: { text: "x", to: "+1" } } };
        let call = 0;

        const queue = {
            ack: vi.fn(),
            enqueue: vi.fn(),
            reserve: vi.fn(() => {
                call += 1;

                if (call === 1) {
                    throw new Error("redis down");
                }

                return call === 2 ? job : undefined;
            }),
            retry: vi.fn(),
            size: vi.fn(() => 0),
        };

        const worker = createQueueWorker(queue, notify, { onError, pollInterval: 10 });

        worker.start();
        await vi.advanceTimersByTimeAsync(50);
        worker.stop();

        expect(onError).toHaveBeenCalledTimes(1);
        expect(provider.getInstance?.().sent).toHaveLength(1);
    });

    it("retries the job and reports onError when send rejects", async () => {
        expect.assertions(3);

        const job = { attempts: 1, id: "j1", message: { sms: { text: "x", to: "+1" } } };
        let reserved = false;

        const queue = {
            ack: vi.fn(),
            enqueue: vi.fn(),
            reserve: vi.fn(() => {
                if (reserved) {
                    return undefined;
                }

                reserved = true;

                return job;
            }),
            retry: vi.fn(),
            size: vi.fn(() => 0),
        };

        const notify = { send: vi.fn().mockRejectedValue(new Error("send failed")) };
        const onError = vi.fn();

        const worker = createQueueWorker(queue, notify as never, { backoff: () => 0, onError });

        await worker.drain();

        expect(onError).toHaveBeenCalledTimes(1);
        expect(queue.retry).toHaveBeenCalledWith("j1", 0);
        expect(queue.ack).not.toHaveBeenCalled();
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
