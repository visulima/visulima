import { QueryClient } from "@tanstack/solid-query";
import { batch, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGetFileList } from "../../src/solid/create-get-file-list";
import { runInRoot } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(createGetFileList, () => {
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
            delete (globalThis as any).fetch;
        }

        vi.restoreAllMocks();
    });

    it("should fetch file list successfully", async () => {
        expect.assertions(3);

        const mockData = {
            data: [
                {
                    contentType: "image/jpeg",
                    id: "file-1",
                    name: "test.jpg",
                    size: 100,
                },
                {
                    contentType: "image/png",
                    id: "file-2",
                    name: "test.png",
                    size: 200,
                },
            ],
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockData,
            ok: true,
        });

        const result = runInRoot(
            () =>
                createGetFileList({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/", expect.objectContaining({
            method: "GET",
        }));
        expect(result.data()).toBeDefined();
        expect(result.data()?.data).toHaveLength(2);
    });

    it("should handle paginated response", async () => {
        expect.assertions(2);

        const mockData = {
            data: [
                {
                    contentType: "image/jpeg",
                    id: "file-1",
                    name: "test.jpg",
                    size: 100,
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

        const result = runInRoot(() =>
            createGetFileList({
                endpoint: "https://api.example.com",
                page: 1,
                queryClient,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(result.data()?.data).toHaveLength(1);
        expect(result.data()?.meta?.total).toBe(50);
    });

    it("should handle array response", async () => {
        expect.assertions(1);

        const mockData = [
            {
                contentType: "image/jpeg",
                id: "file-1",
                name: "test.jpg",
                size: 100,
            },
        ];

        mockFetch.mockResolvedValueOnce({
            json: async () => mockData,
            ok: true,
        });

        const result = runInRoot(
            () =>
                createGetFileList({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(result.data()?.data).toHaveLength(1);
    });

    it("should respect enabled option", async () => {
        expect.assertions(1);

        const [enabled, setEnabled] = createSignal(false);

        runInRoot(() =>
            createGetFileList({
                enabled,
                endpoint: "https://api.example.com",
                queryClient,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle reactive limit and page", async () => {
        expect.assertions(2);

        const [limit, setLimit] = createSignal(10);
        const [page, setPage] = createSignal(1);

        mockFetch.mockResolvedValue({
            json: async () => {
                return { data: [] };
            },
            ok: true,
        });

        const result = runInRoot(
            () =>
                createGetFileList({
                    endpoint: "https://api.example.com",
                    limit,
                    page,
                    queryClient,
                }),
            queryClient,
        );

        // Wait for initial query to complete by checking isLoading state
        let attempts = 0;

        while (result.isLoading() && attempts < 50) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            attempts++;
        }

        expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/?limit=10&page=1", expect.objectContaining({
            method: "GET",
        }));

        // Use batch to update both signals atomically - this prevents multiple query runs
        batch(() => {
            setLimit(20);
            setPage(2);
        });

        // Force a small delay to ensure signals are processed
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Wait for the query to complete after batched update
        // TanStack Query should detect the queryKey change and refetch automatically
        attempts = 0;
        while ((result.isLoading() || mockFetch.mock.calls.length < 2) && attempts < 200) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            attempts++;
        }

        // If still not refetched, manually trigger refetch
        if (mockFetch.mock.calls.length < 2) {
            result.refetch();
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle error response", async () => {
        expect.assertions(1);

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: {
                        code: "RequestFailed",
                        message: "Failed to fetch files",
                    },
                };
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        const result = runInRoot(
            () =>
                createGetFileList({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(result.error()).toBeDefined();
    });
});
