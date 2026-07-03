import { QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTransformMetadata } from "../../src/vue/use-transform-metadata";
import { waitForReady, withQueryClient } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(useTransformMetadata, () => {
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

    it("returns formats and parameters", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    formats: ["jpeg", "png", "webp"],
                    parameters: ["width", "height", "quality"],
                };
            },
            ok: true,
            status: 200,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useTransformMetadata({
                    endpoint: "https://api.example.com/transform",
                }),
            queryClient,
        );

        await waitForReady(() => result.data.value !== undefined);

        expect(result.data.value?.formats).toContain("webp");
        expect(result.data.value?.parameters).toContain("quality");

        unmount();
    });

    it("does not fetch when disabled", () => {
        expect.assertions(2);

        const { result, unmount } = withQueryClient(
            () =>
                useTransformMetadata({
                    enabled: false,
                    endpoint: "https://api.example.com/transform",
                }),
            queryClient,
        );

        expect(mockFetch).not.toHaveBeenCalled();
        expect(result.data.value).toBeUndefined();

        unmount();
    });
});
