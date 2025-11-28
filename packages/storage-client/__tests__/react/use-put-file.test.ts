import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePutFile } from "../../src/react/use-put-file";
import { MockXMLHttpRequest } from "../mock-xhr";
import { renderHookWithQueryClient } from "./test-utils";

// Extended MockXMLHttpRequest with custom getResponseHeader for use-put-file tests
class CustomMockXMLHttpRequest extends MockXMLHttpRequest {
    public override send = vi.fn(() => {
        // Fire progress event
        setTimeout(() => {
            const progressHandlers = this.uploadEventListeners.get("progress");

            if (progressHandlers) {
                const progressEvent = {
                    lengthComputable: true,
                    loaded: 50,
                    total: 100,
                } as ProgressEvent;

                progressHandlers.forEach((handler) => handler(progressEvent));
            }
        }, 10);

        // Fire load event after upload completes (longer delay for this test)
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

    // eslint-disable-next-line unicorn/no-null -- XMLHttpRequest.getResponseHeader returns string | null
    public override getResponseHeader = vi.fn((header: string) => {
        if (header === "Location") {
            return "https://api.example.com/files/file-123";
        }

        if (header === "ETag") {
            return "\"test-etag\"";
        }

        return undefined;
    });
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
        globalThis.XMLHttpRequest = CustomMockXMLHttpRequest as unknown as typeof XMLHttpRequest;
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
    });

    it("should upload file successfully", async () => {
        expect.assertions(6);

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
        expect(result.current.error).toBeUndefined();
    });

    it("should track upload progress", async () => {
        expect.assertions(3);

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

        // Wait for progress to update (the mock fires progress after 50ms)
        await waitFor(
            () => {
                expect(result.current.progress).toBeGreaterThan(0);
            },
            { timeout: 1000 },
        );

        await uploadPromise;

        expect(onProgress).toHaveBeenCalledWith(50);
    });

    it("should handle upload errors", async () => {
        expect.assertions(3);

        // eslint-disable-next-line @typescript-eslint/member-ordering -- Mock class follows XMLHttpRequest API structure
        class ErrorXHR extends CustomMockXMLHttpRequest {
            public send = vi.fn(() => {
                const triggerLoadHandlers = (): void => {
                    this.readyState = 4;
                    this.status = 500;
                    this.statusText = "Internal Server Error";
                    this.responseText = JSON.stringify({ error: { message: "Upload failed" } });

                    const handlers = this.eventListeners.get("load");

                    if (handlers) {
                        handlers.forEach((handler) => handler(new Event("load")));
                    }
                };

                setTimeout(triggerLoadHandlers, 20);
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
            expect(result.current.error).toBeDefined();
        });

        expect(result.current.isLoading).toBe(false);
    });

    it("should invalidate queries on success", async () => {
        expect.assertions(1);

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
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({
                queryKey: ["storage", "files", "https://api.example.com"],
            });
        });
    });

    it("should reset mutation state", async () => {
        expect.assertions(5);

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
            expect(result.current.data).toBeUndefined();
        });

        expect(result.current.progress).toBe(0);
    });
});
