import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetFileList } from "../../src/react/use-get-file-list";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();

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

        expect(result.current.data).toEqual(mockData);
    });

    it("should handle paginated response", async () => {

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

        expect(result.current.data?.meta).toEqual(mockData.meta);
    });

    it("should handle array response", async () => {

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
            expect(result.current.data?.data).toEqual(mockData);
        });
    });

    it("should call onSuccess callback", async () => {

        const onSuccess = vi.fn();
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
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it("should handle error and call onError callback", async () => {

        const onError = vi.fn();

        mockFetch.mockResolvedValueOnce({
            json: async () => ({
                error: {
                    code: "ERROR",
                    message: "Request failed",
                },
            }),
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
            expect(onError).toHaveBeenCalled();
        });
    });

    it("should respect enabled option", async () => {
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

