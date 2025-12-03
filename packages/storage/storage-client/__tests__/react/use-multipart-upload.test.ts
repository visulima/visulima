import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMultipartAdapter } from "../../src/core/multipart-adapter";
import type { UploadItem } from "../../src/core/uploader";
import { MockXMLHttpRequest } from "./test-utils";

describe("useMultipartUpload", () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = globalThis.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = MockXMLHttpRequest;
        vi.clearAllMocks();
        vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
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

    it("should handle upload progress events", async () => {
        expect.assertions(2);

        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        const { uploader } = adapter;
        let progressReceived = false;

        uploader.on("ITEM_PROGRESS", (item: UploadItem) => {
            progressReceived = true;

            expect(item.completed).toBeGreaterThan(0);
        });

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
        const uploadPromise = adapter.upload(file);

        // Wait for progress event
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 15);
        });

        await uploadPromise;

        expect(progressReceived).toBe(true);
    });

    it("should handle upload completion", async () => {
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

    it("should clear timeout on successful upload", async () => {
        expect.assertions(1);

        const adapter = createMultipartAdapter({
            endpoint: "/api/upload",
        });

        const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        await adapter.upload(file);

        // Wait a bit to ensure timeout would have fired if not cleared
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 50);
        });

        // Timeout should have been cleared
        // In Node.js, setTimeout returns a Timeout object.
        expect(clearTimeoutSpy).toHaveBeenCalledWith(expect.anything());
    });
});
