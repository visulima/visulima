import { QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGetFileList } from "../../src/vue/use-get-file-list";
import { waitForReady, withQueryClient } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(useGetFileList, () => {
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

    it("returns the array body unchanged when the server replies with a plain array", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            json: async () => [{ id: "file-1" }, { id: "file-2" }],
            ok: true,
            status: 200,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useGetFileList({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await waitForReady(() => Array.isArray(result.data.value?.data));

        expect(result.data.value?.data).toHaveLength(2);
        expect(result.data.value?.meta).toBeUndefined();

        unmount();
    });

    it("preserves pagination meta on paginated responses", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    data: [{ id: "file-1" }],
                    meta: { page: 1, perPage: 10, total: 1 },
                };
            },
            ok: true,
            status: 200,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useGetFileList({
                    endpoint: "https://api.example.com",
                    page: 1,
                }),
            queryClient,
        );

        await waitForReady(() => result.data.value?.meta !== undefined);

        expect(result.data.value?.data).toHaveLength(1);
        expect(result.data.value?.meta?.total).toBe(1);

        unmount();
    });

    it("does not fetch when disabled", () => {
        expect.assertions(2);

        const { result, unmount } = withQueryClient(
            () =>
                useGetFileList({
                    enabled: false,
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        expect(mockFetch).not.toHaveBeenCalled();
        expect(result.data.value).toBeUndefined();

        unmount();
    });
});
