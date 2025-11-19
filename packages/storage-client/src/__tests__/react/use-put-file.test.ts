import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePutFile } from "../../react/use-put-file";
import { renderHookWithQueryClient } from "./test-utils";

// Mock XMLHttpRequest for progress tracking
class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    public upload = {
        addEventListener: vi.fn((event: string, handler: (event: ProgressEvent) => void) => {
            // Simulate progress
            setTimeout(() => {
                const progressEvent = {
                    lengthComputable: true,
                    loaded: 50,
                    total: 100,
                } as ProgressEvent;

                handler(progressEvent);
            }, 50);
        }),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn(() => {
        setTimeout(() => {
            this.readyState = 4;
            this.status = 200;
            this.responseText = JSON.stringify({ id: "file-123" });

            const handlers = this.eventListeners.get("load");

            if (handlers) {
                handlers.forEach((handler) => handler(new Event("load")));
            }
        }, 100);
    });

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn((header: string) => {
        if (header === "Location") {
            return "https://api.example.com/files/file-123";
        }

        if (header === "ETag") {
            return "\"test-etag\"";
        }

        return null;
    });

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();

    public abort = vi.fn();
}

describe(usePutFile, () => {
    let queryClient: QueryClient;
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        originalXHR = globalThis.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = MockXMLHttpRequest;
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
    });

    it("should upload file successfully", async () => {
        // expect.assertions(4);

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        const { result } = renderHookWithQueryClient(
            () =>
                usePutFile({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        const uploadPromise = result.current.putFile("file-123", file);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(true);
        });

        await uploadPromise;

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toMatchObject({
            id: "file-123",
            url: expect.stringContaining("file-123"),
        });
        expect(result.current.error).toBeNull();
    });

    it("should track upload progress", async () => {
        // expect.assertions(2);

        const onProgress = vi.fn();
        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        const { result } = renderHookWithQueryClient(
            () =>
                usePutFile({
                    endpoint: "https://api.example.com",
                    onProgress,
                }),
            { queryClient },
        );

        const uploadPromise = result.current.putFile("file-123", file);

        await waitFor(
            () => {
                expect(result.current.progress).toBeGreaterThan(0);
            },
            { timeout: 100 },
        );

        await uploadPromise;

        expect(onProgress).toHaveBeenCalledWith();
    });

    it("should handle upload errors", async () => {
        // expect.assertions(2);

        class ErrorXHR extends MockXMLHttpRequest {
            public send = vi.fn(() => {
                setTimeout(() => {
                    this.readyState = 4;
                    this.status = 500;
                    this.statusText = "Internal Server Error";
                    this.responseText = JSON.stringify({ error: { message: "Upload failed" } });

                    const handlers = this.eventListeners.get("load");

                    if (handlers) {
                        handlers.forEach((handler) => handler(new Event("load")));
                    }
                }, 20);
            });
        }

        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = ErrorXHR;

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        const { result } = renderHookWithQueryClient(
            () =>
                usePutFile({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        try {
            await result.current.putFile("file-123", file);
        } catch {
            // Expected to throw
        }

        await waitFor(() => {
            expect(result.current.error).not.toBeNull();
        });

        expect(result.current.isLoading).toBe(false);
    });

    it("should invalidate queries on success", async () => {
        // expect.assertions(1);

        const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        const { result } = renderHookWithQueryClient(
            () =>
                usePutFile({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await result.current.putFile("file-123", file);

        await waitFor(() => {
            expect(invalidateQueriesSpy).toHaveBeenCalledWith();
        });
    });

    it("should reset mutation state", async () => {
        // expect.assertions(3);

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        const { result } = renderHookWithQueryClient(
            () =>
                usePutFile({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await result.current.putFile("file-123", file);

        await waitFor(() => {
            expect(result.current.data).toBeDefined();
        });

        result.current.reset();

        await waitFor(() => {
            expect(result.current.data).toBeNull();
        });

        expect(result.current.progress).toBe(0);
    });
});
