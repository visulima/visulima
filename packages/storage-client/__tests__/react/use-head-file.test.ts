import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useHeadFile } from "../../src/react/use-head-file";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

describe(useHeadFile, () => {
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

    it("should fetch file metadata via HEAD request", async () => {
        const mockHeaders = new Headers({
            "Content-Length": "1024",
            "Content-Type": "image/jpeg",
            ETag: "\"test-etag\"",
            "Last-Modified": "Wed, 21 Oct 2015 07:28:00 GMT",
        });

        mockFetch.mockResolvedValueOnce({
            headers: mockHeaders,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data?.contentLength).toBe(1024);
    });

    it("should extract upload metadata", async () => {
        const mockHeaders = new Headers({
            "X-Chunked-Upload": "true",
            "X-Upload-Complete": "false",
            "X-Upload-Expires": "2025-12-31T23:59:59Z",
            "X-Upload-Offset": "500",
        });

        mockFetch.mockResolvedValueOnce({
            headers: mockHeaders,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.data?.uploadOffset).toBe(500);
            expect(result.current.data?.uploadComplete).toBe(false);
            expect(result.current.data?.uploadExpires).toBe("2025-12-31T23:59:59Z");
            expect(result.current.data?.chunkedUpload).toBe(true);
        });
    });

    it("should parse received chunks", async () => {
        const mockHeaders = new Headers({
            "X-Received-Chunks": JSON.stringify([0, 1024, 2048]),
        });

        mockFetch.mockResolvedValueOnce({
            headers: mockHeaders,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.data?.receivedChunks).toEqual([0, 1024, 2048]);
        });
    });

    it("should call onSuccess callback", async () => {
        const onSuccess = vi.fn();
        const mockHeaders = new Headers({
            "Content-Length": "1024",
        });

        mockFetch.mockResolvedValueOnce({
            headers: mockHeaders,
            ok: true,
        });

        renderHookWithQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    onSuccess,
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith(expect.any(Object));
        });
    });

    it("should handle error and call onError callback", async () => {
        const onError = vi.fn();

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: {
                        code: "NOT_FOUND",
                        message: "File not found",
                    },
                };
            },
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        renderHookWithQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    onError,
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    it("should respect enabled option", async () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useHeadFile({
                    enabled: false,
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient },
        );

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeUndefined();
    });

    it("should not fetch when id is empty", async () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "",
                }),
            { queryClient },
        );

        expect(result.current.isLoading).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should refetch data", async () => {
        const mockHeaders = new Headers({
            "Content-Length": "1024",
        });

        mockFetch.mockResolvedValue({
            headers: mockHeaders,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        result.current.refetch();

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
});
