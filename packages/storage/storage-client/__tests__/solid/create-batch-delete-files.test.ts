import { QueryClient } from "@tanstack/solid-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBatchDeleteFiles } from "../../src/solid/create-batch-delete-files";
import { runInRoot } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(createBatchDeleteFiles, () => {
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

    it("reports counts from response headers", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Delete-Failed": "1",
                "X-Delete-Successful": "2",
            }),
            ok: true,
            status: 207,
        });

        const result = runInRoot(
            () =>
                createBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        const deleted = await result.batchDeleteFiles(["file-1", "file-2"]);

        expect(deleted.successful).toBe(2);
        expect(deleted.failed).toBe(1);
    });

    it("infers totals from a 204 response", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            ok: true,
            status: 204,
        });

        const result = runInRoot(
            () =>
                createBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        const deleted = await result.batchDeleteFiles(["a", "b", "c"]);

        expect(deleted.successful).toBe(3);
        expect(deleted.failed).toBe(0);
    });

    it("rejects with the server-provided message on failure", async () => {
        expect.assertions(1);

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return { error: { code: "RequestFailed", message: "Batch delete failed" } };
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        const result = runInRoot(
            () =>
                createBatchDeleteFiles({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await expect(result.batchDeleteFiles(["file-1"])).rejects.toThrow("Batch delete failed");
    });
});
