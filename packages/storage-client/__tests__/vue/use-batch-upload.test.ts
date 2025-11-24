import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBatchUpload } from "../../src/vue/use-batch-upload";
import { withQueryClient } from "./test-utils";

// Mock XMLHttpRequest
class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    public response = "";

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    private uploadEventListeners = new Map<string, Set<(event: ProgressEvent) => void>>();

    public upload = {
        addEventListener: vi.fn((event: string, handler: (event: ProgressEvent) => void) => {
            if (!this.uploadEventListeners.has(event)) {
                this.uploadEventListeners.set(event, new Set());
            }

            this.uploadEventListeners.get(event)?.add(handler);
        }),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn((data?: FormData) => {
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

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => null);

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();

    public abort = vi.fn();
}

describe(useBatchUpload, () => {
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

    it("should initialize with default values", () => {
        expect.assertions(5);

        const { result } = withQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
            }),
        );

        expect(result.items.value).toEqual([]);
        expect(result.progress.value).toBe(0);
        expect(result.isUploading.value).toBe(false);
        expect(result.completedCount.value).toBe(0);
        expect(result.errorCount.value).toBe(0);
    });

    it("should upload batch of files", () => {
        expect.assertions(1);

        const { result } = withQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
            }),
        );

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        const itemIds = result.uploadBatch([file1, file2]);

        expect(itemIds).toHaveLength(2);
    });

    it("should call onStart callback when batch starts", () => {
        expect.assertions(1);

        const onStart = vi.fn();

        const { result } = withQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
                onStart,
            }),
        );

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        result.uploadBatch([file1]);

        expect(onStart).toHaveBeenCalledWith();
    });

    it("should reset batch state", () => {
        expect.assertions(5);

        const { result } = withQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
            }),
        );

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        result.uploadBatch([file1]);
        result.reset();

        expect(result.items.value).toEqual([]);
        expect(result.progress.value).toBe(0);
        expect(result.isUploading.value).toBe(false);
        expect(result.completedCount.value).toBe(0);
        expect(result.errorCount.value).toBe(0);
    });
});
