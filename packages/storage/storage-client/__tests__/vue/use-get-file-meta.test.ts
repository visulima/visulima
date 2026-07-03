import { QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGetFileMeta } from "../../src/vue/use-get-file-meta";
import { waitForReady, withQueryClient } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(useGetFileMeta, () => {
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

    it("fetches metadata and falls back to the provided id", async () => {
        expect.assertions(3);

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return { name: "image.jpg", size: 4096 };
            },
            ok: true,
            status: 200,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useGetFileMeta({
                    endpoint: "https://api.example.com",
                    id: "file-9",
                }),
            queryClient,
        );

        await waitForReady(() => result.data.value !== undefined);

        expect(result.data.value?.id).toBe("file-9");
        expect(result.data.value?.name).toBe("image.jpg");
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("file-9/metadata"), expect.any(Object));

        unmount();
    });

    it("does not fetch when id is empty", () => {
        expect.assertions(2);

        const { result, unmount } = withQueryClient(
            () =>
                useGetFileMeta({
                    endpoint: "https://api.example.com",
                    id: "",
                }),
            queryClient,
        );

        expect(result.isLoading.value).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();

        unmount();
    });
});
