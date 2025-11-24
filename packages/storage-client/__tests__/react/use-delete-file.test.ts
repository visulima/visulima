import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDeleteFile } from "../../src/react/use-delete-file";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();

describe(useDeleteFile, () => {
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

    it("should delete file successfully", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useDeleteFile({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await result.current.deleteFile("file-123");

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("file-123"),
            expect.objectContaining({
                method: "DELETE",
            }),
        );
    });

    it("should call onSuccess callback", async () => {
        expect.assertions(1);

        const onSuccess = vi.fn();

        mockFetch.mockResolvedValueOnce({
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useDeleteFile({
                    endpoint: "https://api.example.com",
                    onSuccess,
                }),
            { queryClient },
        );

        await result.current.deleteFile("file-123");

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it("should handle error and call onError callback", async () => {
        expect.assertions(2);

        const onError = vi.fn();

        mockFetch.mockResolvedValueOnce({
            json: async () => ({
                error: {
                    code: "NOT_FOUND",
                    message: "File not found",
                },
            }),
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useDeleteFile({
                    endpoint: "https://api.example.com",
                    onError,
                }),
            { queryClient },
        );

        await expect(result.current.deleteFile("file-123")).rejects.toThrow();

        await waitFor(() => {
            expect(onError).toHaveBeenCalled();
        });
    });

    it("should reset mutation state", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useDeleteFile({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await result.current.deleteFile("file-123");

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        result.current.reset();

        expect(result.current.error).toBeUndefined();
    });
});

