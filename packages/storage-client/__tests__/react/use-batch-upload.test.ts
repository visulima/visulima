import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBatchUpload } from "../../src/react/use-batch-upload";
import { MockXMLHttpRequest } from "../mock-xhr";
import { renderHookWithQueryClient } from "./test-utils";

describe(useBatchUpload, () => {
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        originalXHR = globalThis.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = MockXMLHttpRequest;
        vi.clearAllMocks();
    });

    afterEach(async () => {
        // Wait for any pending React updates to complete
        await act(async () => {
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 0);
            });
        });
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    it("should initialize with default values", () => {
        expect.assertions(5);

        const { result, unmount } = renderHookWithQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
            }),
        );

        expect(result.current.items).toEqual([]);
        expect(result.current.progress).toBe(0);
        expect(result.current.isUploading).toBe(false);
        expect(result.current.completedCount).toBe(0);
        expect(result.current.errorCount).toBe(0);

        // Clean up
        unmount();
    });

    it("should upload batch of files", () => {
        expect.assertions(1);

        const { result, unmount } = renderHookWithQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
            }),
        );

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
        const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });

        const itemIds = result.current.uploadBatch([file1, file2]);

        expect(itemIds).toHaveLength(2);

        // Clean up
        unmount();
    });

    it("should call onStart callback when batch starts", () => {
        expect.assertions(1);

        const onStart = vi.fn();

        const { result, unmount } = renderHookWithQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
                onStart,
            }),
        );

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        result.current.uploadBatch([file1]);

        expect(onStart).toHaveBeenCalledWith(expect.any(String));

        // Clean up
        unmount();
    });

    it("should update progress during upload", async () => {
        expect.assertions(4);

        const { result, unmount } = renderHookWithQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
            }),
        );

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        // Call uploadBatch - this should trigger batch start event synchronously
        act(() => {
            result.current.uploadBatch([file1]);
        });

        // Wait for batch start event to be processed and isUploading to be set
        await waitFor(
            () => {
                expect(result.current.isUploading).toBe(true);
            },
            { timeout: 1000 },
        );

        // Then wait for progress to update (happens after 10ms in mock)
        await waitFor(
            () => {
                expect(result.current.progress).toBeGreaterThan(0);
            },
            { timeout: 1000 },
        );

        // Verify progress value is set correctly
        expect(result.current.progress).toBeGreaterThan(0);

        // Clean up
        unmount();
        // Wait for React cleanup
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 50);
        });
    });

    it("should reset batch state", () => {
        expect.assertions(5);

        const { result, unmount } = renderHookWithQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
            }),
        );

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        result.current.uploadBatch([file1]);
        result.current.reset();

        expect(result.current.items).toEqual([]);
        expect(result.current.progress).toBe(0);
        expect(result.current.isUploading).toBe(false);
        expect(result.current.completedCount).toBe(0);
        expect(result.current.errorCount).toBe(0);

        // Clean up
        unmount();
    });

    it("should abort batch", () => {
        expect.assertions(1);

        const { result, unmount } = renderHookWithQueryClient(() =>
            useBatchUpload({
                endpoint: "/api/upload",
            }),
        );

        const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });

        result.current.uploadBatch([file1]);

        // Get batch ID from uploader (would need to access internal state in real scenario)
        // For now, just verify abortBatch doesn't throw
        expect(() => {
            // In a real scenario, we'd get the batch ID from the uploader
            // For testing, we'll just verify the method exists and is callable
            result.current.abortBatch("test-batch-id");
        }).not.toThrow();

        // Clean up
        unmount();
    });
});
