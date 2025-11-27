import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUploader } from "../../src/core/uploader";

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

    public send = vi.fn<[Document | XMLHttpRequestBodyInit | null?], void>();

    public setRequestHeader = vi.fn<[string, string], void>();

    public getResponseHeader = vi.fn<[string], string | null>(() => undefined);

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

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    private uploadEventListeners = new Map<string, Set<(event: ProgressEvent) => void>>();
}

describe(createUploader, () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = globalThis.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = MockXMLHttpRequest;
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should create uploader instance", () => {
        expect.assertions(6);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });

        expect(uploader).toBeDefined();
        expect(uploader.add).toBeDefined();
        expect(uploader.abort).toBeDefined();
        expect(uploader.clear).toBeDefined();
        expect(uploader.on).toBeDefined();
        expect(uploader.off).toBeDefined();
    });

    it("should add file and emit ITEM_START event", () => {
        expect.assertions(2);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onItemStart = vi.fn<[unknown], void>();

        uploader.on("ITEM_START", onItemStart);

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const itemId = uploader.add(file);

        expect(itemId).toBeDefined();
        // ITEM_START is emitted when add is called
        expect(onItemStart).toHaveBeenCalledWith(
            expect.objectContaining({
                file: expect.any(File),
                id: expect.any(String),
            }),
        );
    });

    it("should handle event listeners", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onItemStart = vi.fn<[unknown], void>();
        const onItemProgress = vi.fn<[unknown], void>();
        const onItemFinish = vi.fn<[unknown], void>();
        const onItemError = vi.fn<[unknown], void>();

        uploader.on("ITEM_START", onItemStart);
        uploader.on("ITEM_PROGRESS", onItemProgress);
        uploader.on("ITEM_FINISH", onItemFinish);
        uploader.on("ITEM_ERROR", onItemError);

        expect(() => {
            uploader.off("ITEM_START", onItemStart);
            uploader.off("ITEM_PROGRESS", onItemProgress);
            uploader.off("ITEM_FINISH", onItemFinish);
            uploader.off("ITEM_ERROR", onItemError);
        }).not.toThrow();
    });

    it("should abort upload", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

        uploader.add(file);

        expect(() => uploader.abort()).not.toThrow();
    });

    it("should clear all uploads", () => {
        expect.assertions(1);

        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        uploader.add(file1);
        uploader.add(file2);

        expect(() => uploader.clear()).not.toThrow();
    });
});
