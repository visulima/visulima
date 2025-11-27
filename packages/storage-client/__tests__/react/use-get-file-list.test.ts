import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetFileList } from "../../src/react/use-get-file-list";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

describe(useGetFileList, () => {
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

    it("should fetch file list successfully", async () => {
        expect.assertions(3);

        const mockData = {
            data: [
                {
                    id: "file-1",
                    name: "file1.txt",
                    size: 100,
                },
                {
                    id: "file-2",
                    name: "file2.txt",
                    size: 200,
                },
            ],
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockData,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFileList({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toStrictEqual(mockData);
    });

    it("should handle paginated response", async () => {
        expect.assertions(3);

        const mockData = {
            data: [
                {
                    id: "file-1",
                    name: "file1.txt",
                },
            ],
            meta: {
                page: 1,
                perPage: 10,
                total: 50,
            },
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockData,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFileList({
                    endpoint: "https://api.example.com",
                    page: 1,
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data?.meta).toStrictEqual(mockData.meta);
    });

    it("should handle array response", async () => {
        expect.assertions(2);

        const mockData = [
            {
                id: "file-1",
                name: "file1.txt",
            },
        ];

        mockFetch.mockResolvedValueOnce({
            json: async () => mockData,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFileList({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.data?.data).toStrictEqual(mockData);
        });
    });

    it("should call onSuccess callback", async () => {
        expect.assertions(2);

        const onSuccess = vi.fn<[unknown], void>();
        const mockData = {
            data: [
                {
                    id: "file-1",
                    name: "file1.txt",
                },
            ],
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockData,
            ok: true,
        });

        renderHookWithQueryClient(
            () =>
                useGetFileList({
                    endpoint: "https://api.example.com",
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

        const onError = vi.fn<[Error], void>();

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: {
                        code: "ERROR",
                        message: "Request failed",
                    },
                };
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        renderHookWithQueryClient(
            () =>
                useGetFileList({
                    endpoint: "https://api.example.com",
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
                useGetFileList({
                    enabled: false,
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeUndefined();
    });

    it("should refetch data", async () => {
        expect.assertions(3);

        const mockData = {
            data: [
                {
                    id: "file-1",
                    name: "file1.txt",
                },
            ],
        };

        mockFetch.mockResolvedValue({
            json: async () => mockData,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFileList({
                    endpoint: "https://api.example.com",
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
