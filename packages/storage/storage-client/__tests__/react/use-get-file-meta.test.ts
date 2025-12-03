import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetFileMeta } from "../../src/react/use-get-file-meta";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();

describe(useGetFileMeta, () => {
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

    it("should fetch file metadata successfully", async () => {
        expect.assertions(3);

        const mockData = {
            contentType: "text/plain",
            id: "file-123",
            name: "test.txt",
            size: 1024,
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockData,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFileMeta({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toStrictEqual(mockData);
    });

    it("should use provided id if not in response", async () => {
        expect.assertions(2);

        const mockData = {
            name: "test.txt",
            size: 1024,
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockData,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFileMeta({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.data?.id).toBe("file-123");
        });
    });

    it("should call onSuccess callback", async () => {
        expect.assertions(2);

        const onSuccess = vi.fn();
        const mockData = {
            id: "file-123",
            name: "test.txt",
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockData,
            ok: true,
        });

        renderHookWithQueryClient(
            () =>
                useGetFileMeta({
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
        expect.assertions(2);

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
                useGetFileMeta({
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
        expect.assertions(2);

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFileMeta({
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
        expect.assertions(2);

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFileMeta({
                    endpoint: "https://api.example.com",
                    id: "",
                }),
            { queryClient },
        );

        expect(result.current.isLoading).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should refetch data", async () => {
        expect.assertions(3);

        const mockData = {
            id: "file-123",
            name: "test.txt",
        };

        mockFetch.mockResolvedValue({
            json: async () => mockData,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFileMeta({
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
