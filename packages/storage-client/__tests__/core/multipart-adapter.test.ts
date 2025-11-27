import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMultipartAdapter } from "../../src/core/multipart-adapter";

// Mock XMLHttpRequest
class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    public response = "";

    public upload = {
        addEventListener: vi.fn<[string, (event: ProgressEvent) => void], void>((event: string, handler: (event: ProgressEvent) => void) => {
            if (!this.uploadEventListeners.has(event)) {
                this.uploadEventListeners.set(event, new Set());
            }

            this.uploadEventListeners.get(event)?.add(handler);
        }),
        removeEventListener: vi.fn<[string, (event: ProgressEvent) => void], void>(),
    };

    public open = vi.fn<[string, string | URL, boolean?, string?, string?], void>();

    public send = vi.fn<[Document | XMLHttpRequestBodyInit | null?], void>((_data?: FormData) => {
        // Simulate upload progress
        setTimeout(() => {
            const handlers = this.uploadEventListeners.get("progress");

            if (handlers) {
                const progressEvent = {
                    lengthComputable: true,
                    loaded: 50,
                    total: 100,
                } as ProgressEvent;

                handlers.forEach((handler) => handler(progressEvent));
            }
        }, 10);

        // Simulate completion
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
                handlers.forEach((handler) => handler(new Event("load")));
            }
        }, 20);
    });

    public setRequestHeader = vi.fn<[string, string], void>();

    public getResponseHeader = vi.fn<[string], string | null>((_name: string) => undefined);

    public addEventListener = vi.fn<[string, (event: Event) => void], void>((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn<[string, (event: Event) => void], void>();

    public abort = vi.fn<[], void>(() => {
        const handlers = this.eventListeners.get("abort");

        if (handlers) {
            handlers.forEach((handler) => handler(new Event("abort")));
        }
    });

    protected eventListeners = new Map<string, Set<(event: Event) => void>>();

    protected uploadEventListeners = new Map<string, Set<(event: ProgressEvent) => void>>();
}

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
        await new Promise((resolve) => setTimeout(resolve, 15));

        await uploadPromise;

        expect(progressReceived).toBe(true);
    });

    it("should handle upload errors", async () => {
        expect.assertions(1);

        // Create a new mock XHR that simulates error
        class ErrorMockXMLHttpRequest extends MockXMLHttpRequest {
            public send = vi.fn((_data?: FormData) => {
                setTimeout(() => {
                    const handlers = this.eventListeners.get("error");

                    if (handlers) {
                        handlers.forEach((handler) => handler(new Event("error")));
                    }
                }, 10);
            });
        }

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = ErrorMockXMLHttpRequest as unknown as typeof XMLHttpRequest;

        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        await expect(adapter.upload(file)).rejects.toThrow();
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
