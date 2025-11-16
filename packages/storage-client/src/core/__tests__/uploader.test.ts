import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUploader } from "../uploader";

// Mock XMLHttpRequest
class MockXMLHttpRequest {
    public onload: ((event: Event) => void) | null = null;
    public onerror: ((event: Event) => void) | null = null;
    public onprogress: ((event: ProgressEvent) => void) | null = null;
    public readyState = 0;
    public status = 200;
    public responseText = "";
    public upload = {
        addEventListener: vi.fn((event: string, handler: (event: ProgressEvent) => void) => {
            if (event === "progress") {
                this.onprogress = handler;
            }
        }),
    };
    public open = vi.fn();
    public send = vi.fn();
    public setRequestHeader = vi.fn();
    public abort = vi.fn();
}

describe("createUploader", () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = global.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        global.XMLHttpRequest = MockXMLHttpRequest;
        vi.clearAllMocks();
    });

    afterEach(() => {
        global.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should create uploader instance", () => {
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
        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onItemStart = vi.fn();

        uploader.on("ITEM_START", onItemStart);

        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const itemId = uploader.add(file);

        expect(itemId).toBeDefined();
        // ITEM_START is emitted when add is called
        expect(onItemStart).toHaveBeenCalled();
    });

    it("should handle event listeners", () => {
        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const onItemStart = vi.fn();
        const onItemProgress = vi.fn();
        const onItemFinish = vi.fn();
        const onItemError = vi.fn();

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
        const uploader = createUploader({
            endpoint: "/api/upload",
        });
        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

        uploader.add(file);
        expect(() => uploader.abort()).not.toThrow();
    });

    it("should clear all uploads", () => {
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

