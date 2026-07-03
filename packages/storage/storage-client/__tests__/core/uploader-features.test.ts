import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUploader } from "../../src/core/uploader";

/** Tracks peak concurrent in-flight uploads across all instances. */
const tracker = { current: 0, peak: 0 };

class ConcurrencyTrackingXHR {
    public status = 200;

    public statusText = "OK";

    public responseText = JSON.stringify({ id: "x", status: "completed" });

    public response = this.responseText;

    public upload = { addEventListener: vi.fn(), removeEventListener: vi.fn() };

    public open = vi.fn();

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => undefined);

    public removeEventListener = vi.fn();

    public abort = vi.fn();

    private listeners = new Map<string, Set<(event: Event) => void>>();

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event)?.add(handler);
    });

    public send = vi.fn(() => {
        tracker.current += 1;
        tracker.peak = Math.max(tracker.peak, tracker.current);

        setTimeout(() => {
            tracker.current -= 1;

            const handlers = this.listeners.get("load");

            handlers?.forEach((handler) => {
                handler(new Event("load"));
            });
        }, 15);
    });
}

/** Counts send() attempts across instances so the first attempt fails, the rest succeed. */
const retryTracker = { attempts: 0 };

class FirstFailThenSucceedXHR {
    public status = 200;

    public statusText = "OK";

    public responseText = JSON.stringify({ id: "x", status: "completed" });

    public response = this.responseText;

    public upload = { addEventListener: vi.fn(), removeEventListener: vi.fn() };

    public open = vi.fn();

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => undefined);

    public removeEventListener = vi.fn();

    public abort = vi.fn();

    private listeners = new Map<string, Set<(event: Event) => void>>();

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        this.listeners.get(event)?.add(handler);
    });

    public send = vi.fn(() => {
        retryTracker.attempts += 1;
        const isFirst = retryTracker.attempts === 1;

        setTimeout(() => {
            const handlers = this.listeners.get(isFirst ? "error" : "load");

            handlers?.forEach((handler) => {
                handler(new Event(isFirst ? "error" : "load"));
            });
        }, 10);
    });
}

describe("uploader features", () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = globalThis.XMLHttpRequest;
        tracker.current = 0;
        tracker.peak = 0;
        retryTracker.attempts = 0;
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 30);
        });
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should cap concurrent uploads to the configured limit", async () => {
        expect.assertions(1);

        // @ts-expect-error - mock
        globalThis.XMLHttpRequest = ConcurrencyTrackingXHR;

        const uploader = createUploader({ concurrency: 2, endpoint: "/api/upload" });

        const files = Array.from({ length: 8 }, (_, index) => new File([`f${String(index)}`], `f${String(index)}.txt`));

        uploader.addBatch(files);

        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 100);
        });

        expect(tracker.peak).toBeLessThanOrEqual(2);
    });

    it("should auto-retry a failed item when retry is enabled", async () => {
        expect.assertions(2);

        // @ts-expect-error - mock
        globalThis.XMLHttpRequest = FirstFailThenSucceedXHR;

        const uploader = createUploader({ endpoint: "/api/upload", maxRetries: 2, retry: true });

        const itemId = uploader.add(new File(["data"], "data.txt"));

        // First attempt fails (+10ms), backoff is 1s, then a success attempt.
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 1100);
        });

        const item = uploader.getItem(itemId);

        expect(item?.status).toBe("completed");
        expect(item?.retryCount).toBe(1);
    });

    it("should throw a RestrictionError from addBatch when too many files", () => {
        expect.assertions(1);

        // @ts-expect-error - mock
        globalThis.XMLHttpRequest = ConcurrencyTrackingXHR;

        const uploader = createUploader({ endpoint: "/api/upload", restrictions: { maxNumberOfFiles: 1 } });

        expect(() => {
            uploader.addBatch([new File(["a"], "a.txt"), new File(["b"], "b.txt")]);
        }).toThrow(/too many files/i);
    });
});
