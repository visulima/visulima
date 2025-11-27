import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBatchDeleteFiles } from "../../src/react/use-batch-delete-files";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
let originalFetch: typeof globalThis.fetch | undefined;

describe(useBatchDeleteFiles, () => {
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

    it("should delete batch of files successfully", async () => {
        expect.assertions(3);

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Delete-Failed": "0",
                "X-Delete-Successful": "2",
            }),
            ok: true,
            status: 204,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        const deleteResult = await result.current.batchDeleteFiles(["file-1", "file-2"]);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(deleteResult.successful).toBe(2);
        expect(deleteResult.failed).toBe(0);
    });

    it("should handle 204 response without headers", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            ok: true,
            status: 204,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        const deleteResult = await result.current.batchDeleteFiles(["file-1", "file-2"]);

        expect(deleteResult.successful).toBe(2);
        expect(deleteResult.failed).toBe(0);
    });

    it("should call onSuccess callback", async () => {
        expect.assertions(1);

        const onSuccess = vi.fn();

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Delete-Successful": "2",
            }),
            ok: true,
            status: 204,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                    onSuccess,
                }),
            { queryClient },
        );

        await result.current.batchDeleteFiles(["file-1", "file-2"]);

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith(
                expect.objectContaining({
                    successful: 2,
                }),
            );
        });
    });

    it("should handle error and call onError callback", async () => {
        expect.assertions(2);

        const onError = vi.fn();

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: {
                        code: "RequestFailed",
                        message: "Batch delete failed",
                    },
                };
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                    onError,
                }),
            { queryClient },
        );

        await expect(result.current.batchDeleteFiles(["file-1", "file-2"])).rejects.toThrow();

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    it("should handle error response without JSON body", async () => {
        expect.assertions(1);

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
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await expect(result.current.batchDeleteFiles(["file-1"])).rejects.toThrow("Internal Server Error");
    });

    it("should reset mutation state", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            ok: true,
            status: 204,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await result.current.batchDeleteFiles(["file-1"]);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        result.current.reset();

        expect(result.current.error).toBeUndefined();
    });

    it("should use buildUrl for absolute endpoints", async () => {
        expect.assertions(1);

        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            ok: true,
            status: 204,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com/files",
                }),
            { queryClient },
        );

        await result.current.batchDeleteFiles(["file-1", "file-2"]);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("https://api.example.com/files"),
                expect.objectContaining({
                    method: "DELETE",
                }),
            );
        });
    });
});
