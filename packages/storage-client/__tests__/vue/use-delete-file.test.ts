import { QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeleteFile } from "../../src/vue/use-delete-file";
import { withQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(useDeleteFile, () => {
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

    it("should delete file successfully", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useDeleteFile({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await result.deleteFile("file-123");

        expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/file-123", expect.objectContaining({
            method: "DELETE",
        }));
        expect(result.error.value).toBeUndefined();

        unmount();
    });

    it("should handle error response", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: {
                        code: "RequestFailed",
                        message: "File not found",
                    },
                };
            },
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const { result, unmount } = withQueryClient(
            () =>
                useDeleteFile({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await expect(result.deleteFile("file-123")).rejects.toThrow();

        expect(result.error.value).toBeDefined();

        unmount();
    });

    it("should reset mutation state", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useDeleteFile({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await result.deleteFile("file-123");

        result.reset();

        expect(result.error.value).toBeUndefined();
        expect(result.isLoading.value).toBe(false);

        unmount();
    });
});
