import { QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBatchDeleteFiles } from "../../src/vue/use-batch-delete-files";
import { withQueryClient } from "./test-utils";

const mockFetch = vi.fn();
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
        globalThis.fetch = mockFetch;
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

    it("reports successful/failed counts from response headers", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Delete-Failed": "1",
                "X-Delete-Successful": "2",
            }),
            ok: true,
            status: 207,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        const deleteResult = await result.batchDeleteFiles(["file-1", "file-2"]);

        expect(deleteResult.successful).toBe(2);
        expect(deleteResult.failed).toBe(1);

        unmount();
    });

    it("infers totals from a 204 response", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            ok: true,
            status: 204,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        const deleteResult = await result.batchDeleteFiles(["file-1", "file-2"]);

        expect(deleteResult.successful).toBe(2);
        expect(deleteResult.failed).toBe(0);

        unmount();
    });

    it("rejects with the server-provided message on failure", async () => {
        expect.assertions(1);

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: { code: "RequestFailed", message: "Batch delete failed" },
                };
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        const { result, unmount } = withQueryClient(
            () =>
                useBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await expect(result.batchDeleteFiles(["file-1"])).rejects.toThrow("Batch delete failed");

        unmount();
    });
});
