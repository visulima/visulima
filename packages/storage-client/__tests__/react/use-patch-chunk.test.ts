import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePatchChunk } from "../../src/react/use-patch-chunk";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();

describe(usePatchChunk, () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        globalThis.fetch = mockFetch;
        vi.clearAllMocks();
    });

    it("should upload chunk successfully", async () => {
        expect.assertions(2);
        const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                ETag: "\"chunk-etag\"",
                "X-Upload-Complete": "false",
                "X-Upload-Offset": "100",
            }),
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                usePatchChunk({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await result.current.patchChunk("file-123", chunk, 0);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data?.id).toBe("file-123");
    });

    it("should handle completed upload", async () => {
        expect.assertions(2);
        const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Complete": "true",
                "X-Upload-Offset": "100",
            }),
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                usePatchChunk({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await result.current.patchChunk("file-123", chunk, 0);

        await waitFor(() => {
            expect(result.current.data?.status).toBe("completed");
        });
    });

    it("should include checksum when provided", async () => {
        expect.assertions(1);
        const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "100",
            }),
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                usePatchChunk({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await result.current.patchChunk("file-123", chunk, 0, "abc123");

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-Chunk-Checksum": "abc123",
                    }),
                }),
            );
        });
    });

    it("should call onSuccess callback", async () => {
        expect.assertions(1);
        const onSuccess = vi.fn();
        const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "100",
            }),
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                usePatchChunk({
                    endpoint: "https://api.example.com",
                    onSuccess,
                }),
            { queryClient },
        );

        await result.current.patchChunk("file-123", chunk, 0);

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith(expect.any(Object));
        });
    });

    it("should handle error and call onError callback", async () => {
        expect.assertions(2);
        const onError = vi.fn();
        const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: {
                        code: "ERROR",
                        message: "Upload failed",
                    },
                };
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        const { result } = renderHookWithQueryClient(
            () =>
                usePatchChunk({
                    endpoint: "https://api.example.com",
                    onError,
                }),
            { queryClient },
        );

        await expect(result.current.patchChunk("file-123", chunk, 0)).rejects.toThrow("Upload failed");

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    it("should reset mutation state", async () => {
        expect.assertions(2);
        const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "100",
            }),
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                usePatchChunk({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await result.current.patchChunk("file-123", chunk, 0);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        result.current.reset();

        expect(result.current.error).toBeUndefined();
    });
});
