import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTransformFile } from "../../src/react/use-transform-file";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
let originalFetch: typeof globalThis.fetch | undefined;

describe(useTransformFile, () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalFetch) {
            globalThis.fetch = originalFetch;
        } else {
            delete (globalThis as { fetch?: typeof fetch }).fetch;
        }

        vi.restoreAllMocks();
    });

    it("should fetch transformed file successfully", async () => {
        expect.assertions(5);

        const mockBlob = new Blob(["transformed content"], { type: "image/jpeg" });
        const mockHeaders = new Headers({
            "Content-Length": "18",
            "Content-Type": "image/jpeg",
            ETag: "\"test-etag\"",
            "Last-Modified": "Wed, 21 Oct 2015 07:28:00 GMT",
        });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: mockHeaders,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useTransformFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    transform: { height: 600, width: 800 },
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toBe(mockBlob);
        expect(result.current.error).toBeUndefined();
        expect(result.current.meta).toMatchObject({
            contentType: "image/jpeg",
            id: "file-123",
            size: 18,
        });
    });

    it("should call onSuccess callback", async () => {
        expect.assertions(2);

        const onSuccess = vi.fn<[Blob, Record<string, unknown>], void>();
        const mockBlob = new Blob(["transformed content"], { type: "image/jpeg" });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({
                "Content-Type": "image/jpeg",
            }),
            ok: true,
        });

        renderHookWithQueryClient(
            () =>
                useTransformFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    onSuccess,
                    transform: { width: 800 },
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith(mockBlob, expect.any(Object));
        });
    });

    it("should handle error and call onError callback", async () => {
        expect.assertions(2);

        const onError = vi.fn<[Error], void>();

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: {
                        code: "RequestFailed",
                        message: "Transform failed",
                    },
                };
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        renderHookWithQueryClient(
            () =>
                useTransformFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    onError,
                    transform: { width: 800 },
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    it("should handle error response without JSON body", async () => {
        expect.assertions(3);

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                throw new Error("Invalid JSON");
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useTransformFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    transform: { width: 800 },
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.error).toBeDefined();
        });

        expect(result.current.error?.message).toBe("Internal Server Error");
    });

    it("should respect enabled option", async () => {
        expect.assertions(2);

        const { result } = renderHookWithQueryClient(
            () =>
                useTransformFile({
                    enabled: false,
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    transform: { width: 800 },
                }),
            { queryClient },
        );

        expect(result.current.isLoading).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not fetch when id is empty", async () => {
        expect.assertions(2);

        const { result } = renderHookWithQueryClient(
            () =>
                useTransformFile({
                    endpoint: "https://api.example.com",
                    id: "",
                    transform: { width: 800 },
                }),
            { queryClient },
        );

        expect(result.current.isLoading).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should refetch transformed file", async () => {
        expect.assertions(3);

        const mockBlob = new Blob(["transformed content"], { type: "image/jpeg" });

        mockFetch.mockResolvedValue({
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({
                "Content-Type": "image/jpeg",
            }),
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useTransformFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    transform: { width: 800 },
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
