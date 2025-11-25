import { QueryClient } from "@tanstack/solid-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDeleteFile } from "../../src/solid/create-delete-file";
import { runInRoot } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(createDeleteFile, () => {
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

        const result = runInRoot(
            () =>
                createDeleteFile({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await result.deleteFile("file-123");

        expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/file-123", expect.objectContaining({
            method: "DELETE",
        }));
        expect(result.error()).toBeUndefined();
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

        const result = runInRoot(
            () =>
                createDeleteFile({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await expect(result.deleteFile("file-123")).rejects.toThrow();

        expect(result.error()).toBeDefined();
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

        const result = runInRoot(
            () =>
                createDeleteFile({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await expect(result.deleteFile("file-123")).rejects.toThrow("Internal Server Error");
    });

    it("should reset mutation state", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
        });

        const result = runInRoot(
            () =>
                createDeleteFile({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await result.deleteFile("file-123");

        result.reset();

        expect(result.error()).toBeUndefined();
        expect(result.isLoading()).toBe(false);
    });
});
