import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUploader } from "../../src/core/uploader";

// Mock XMLHttpRequest that simulates error
class ErrorMockXMLHttpRequest {
    public readyState = 0;

    public status = 500;

    public statusText = "Internal Server Error";

    public responseText = "";

    public response = "";

    public upload = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn((_data?: FormData) => {
        // Simulate error
        setTimeout(() => {
            const handlers = this.eventListeners.get("error");

            if (handlers) {
                handlers.forEach((handler) => {
                    handler(new Event("error"));
                });
            }
        }, 10);
    });

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => undefined);

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();

    public abort = vi.fn();

    private eventListeners = new Map<string, Set<(event: Event) => void>>();
}

// Mock XMLHttpRequest that succeeds on retry
class RetrySuccessMockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    public response = "";

    public upload = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn(() => {
        this.attemptCount = (this.attemptCount ?? 0) + 1;

        // First attempt fails, second succeeds
        if (this.attemptCount === 1) {
            setTimeout(() => {
                const handlers = this.eventListeners.get("error");

                if (handlers) {
                    handlers.forEach((handler) => {
                        handler(new Event("error"));
                    });
                }
            }, 10);
        } else {
            setTimeout(() => {
                this.readyState = 4;
                this.status = 200;
                this.responseText = JSON.stringify({
                    contentType: "image/jpeg",
                    id: "test-id",
                    name: "test-name",
                    originalName: "test.jpg",
                    size: 100,
                    status: "completed",
                });
                this.response = this.responseText;

                const handlers = this.eventListeners.get("load");

                if (handlers) {
                    handlers.forEach((handler) => {
                        handler(new Event("load"));
                    });
                }
            }, 10);
        }
    });

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => undefined);

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();

    public abort = vi.fn();

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    private _uploadEventListeners = new Map<string, Set<(event: ProgressEvent) => void>>();

    private attemptCount = 0;
}

describe("uploader Retry Operations", () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = globalThis.XMLHttpRequest;
        vi.clearAllMocks();
        // Expected: the failing-XHR mocks make the uploader emit
        // `console.error("[Uploader] …")`. Silencing keeps post-teardown
        // log writes from racing with the vitest worker shutdown
        // (EnvironmentTeardownError: Closing rpc while "onUserConsoleLog"
        // was pending).
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(async () => {
        // Drain any in-flight XHR timers (mock ones fire at +10ms; real
        // happy-dom XHR in tests that don't set a mock will ECONNREFUSE
        // localhost:3000 a few ms later). Letting them settle here means
        // the uploader's `console.error` lands on the still-active spy
        // instead of racing the vitest worker shutdown
        // (EnvironmentTeardownError: Closing rpc while "onUserConsoleLog"
        // was pending).
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 50);
        });
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should retry failed item", async () => {
        expect.assertions(2);

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = RetrySuccessMockXMLHttpRequest;

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onItemStart = vi.fn();

        uploader.on("ITEM_START", onItemStart);

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const itemId = uploader.add(file);

        // Wait for error to be processed
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 50);
        });

        const item = uploader.getItem(itemId);

        expect(item?.status).toBe("error");

        // Retry the item
        uploader.retryItem(itemId);

        // Wait for retry start
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 5);
        });

        // Should have been called at least twice (initial + retry)
        expect(onItemStart.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("should track retry count", async () => {
        expect.assertions(2);

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = ErrorMockXMLHttpRequest;

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const itemId = uploader.add(file);

        // Wait for error
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 15);
        });

        uploader.retryItem(itemId);

        // Wait long enough for the mock XHR's 10ms error timer to fire
        // inside the test, otherwise the post-teardown error callback
        // triggers console.error after the worker has started closing.
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 25);
        });

        const item = uploader.getItem(itemId);

        expect(item?.retryCount).toBeGreaterThan(0);
        expect(item?.retryCount).toBe(1);
    });

    it("should retry all failed items in batch", async () => {
        expect.assertions(2);

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = ErrorMockXMLHttpRequest;

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1, file2]);

        // Wait for errors
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 15);
        });

        const batches = uploader.getBatches();
        const batchId = batches[0]?.id;

        expect(batchId).toBeDefined();

        uploader.retryBatch(batchId!);

        // retryBatch sets batch.status synchronously; checking immediately avoids
        // racing the mock's 10ms error timer that re-flips the status back to "error".
        const batch = uploader.getBatch(batchId!);

        expect(batch?.status).toBe("uploading");

        // Let the retry's 10ms error timers fire inside the test so the
        // post-teardown console.error in the uploader's error path doesn't
        // race the worker shutdown.
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 25);
        });
    });

    it("should re-queue manual retries through the concurrency cap", async () => {
        expect.assertions(2);

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = ErrorMockXMLHttpRequest;

        const uploader = createUploader({
            concurrency: 1,
            endpoint: "/api/upload",
        });

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        uploader.addBatch([file1, file2]);

        const batchId = uploader.getBatches()[0]?.id;

        // Let both items fail (the error mock rejects after 10ms; concurrency 1
        // means the second runs only after the first settles).
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 40);
        });

        // Swap to a mock whose send never completes, so retried items stay
        // "uploading" and we can observe how many run at once.
        class NeverCompleteMockXMLHttpRequest {
            public upload = { addEventListener: vi.fn(), removeEventListener: vi.fn() };

            public open = vi.fn();

            public send = vi.fn();

            public setRequestHeader = vi.fn();

            public getResponseHeader = vi.fn(() => undefined);

            public addEventListener = vi.fn();

            public removeEventListener = vi.fn();

            public abort = vi.fn();
        }

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = NeverCompleteMockXMLHttpRequest;

        uploader.retryBatch(batchId!);

        // The concurrency cap of 1 must hold: only one retried item is uploading,
        // the other waits in the queue instead of firing a second parallel XHR.
        const uploading = uploader.getItems().filter((item) => item.status === "uploading");
        const pending = uploader.getItems().filter((item) => item.status === "pending");

        expect(uploading).toHaveLength(1);
        expect(pending).toHaveLength(1);
    });

    it("should not retry non-error items", () => {
        expect.assertions(2);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const itemId = uploader.add(file);

        const item = uploader.getItem(itemId);

        expect(item?.status).not.toBe("error");

        const initialRetryCount = item?.retryCount ?? 0;

        uploader.retryItem(itemId);

        // Retry count should not increment for non-error items (retryItem returns early)
        const updatedItem = uploader.getItem(itemId);

        // retryCount should remain the same (0) since retryItem returns early for non-error items
        expect(updatedItem?.retryCount ?? 0).toBe(initialRetryCount);
    });
});
