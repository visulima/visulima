import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMultipartAdapter } from "../../src/core/multipart-adapter";
import { MockXMLHttpRequest } from "../mock-xhr";

describe(createMultipartAdapter, () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = globalThis.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = MockXMLHttpRequest;
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
        vi.clearAllMocks();
    });

    it("should create adapter with correct options", () => {
        expect.assertions(4);

        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
            metadata: { test: "value" },
        });

        expect(adapter).toBeDefined();
        expect(adapter.upload).toBeDefined();
        expect(adapter.abort).toBeDefined();
        expect(adapter.clear).toBeDefined();
    });

    it("should upload file successfully", async () => {
        expect.assertions(4);

        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
        const result = await adapter.upload(file);

        expect(result).toBeDefined();
        expect(result.id).toBe("test-id");
        expect(result.filename).toBe("test.jpg");
        expect(result.status).toBe("completed");
    });

    it("should handle upload progress", async () => {
        expect.assertions(1);

        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        let progressReceived = false;
        const { uploader } = adapter;

        uploader.on("ITEM_PROGRESS", () => {
            progressReceived = true;
        });

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
        const uploadPromise = adapter.upload(file);

        // Wait a bit for progress event
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 15);
        });

        await uploadPromise;

        expect(progressReceived).toBe(true);
    });

    it("should handle upload errors", async () => {
        expect.assertions(1);

        // Create a new mock XHR that simulates error
        // eslint-disable-next-line @typescript-eslint/member-ordering -- Mock class follows XMLHttpRequest API structure
        class ErrorMockXMLHttpRequest extends MockXMLHttpRequest {
            public send = vi.fn((_data?: FormData) => {
                const triggerErrorHandlers = (): void => {
                    const handlers = this.eventListeners.get("error");

                    if (handlers) {
                        handlers.forEach((handler) => handler(new Event("error")));
                    }
                };

                setTimeout(triggerErrorHandlers, 10);
            });
        }

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = ErrorMockXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        await expect(adapter.upload(file)).rejects.toThrow("Network error during upload");
    });

    it("should abort upload", () => {
        expect.assertions(1);

        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        expect(() => adapter.abort()).not.toThrow();
    });

    it("should clear uploads", () => {
        expect.assertions(1);

        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        expect(() => adapter.clear()).not.toThrow();
    });
});
