import { QueryClient } from "@tanstack/solid-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTransformMetadata } from "../../src/solid/create-transform-metadata";
import { runInRoot } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

const flush = (ms = 100): Promise<void> =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

describe(createTransformMetadata, () => {
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

        const result = runInRoot(
            () =>
                createTransformMetadata({
                    endpoint: "https://api.example.com/transform",
                }),
            queryClient,
        );

        await flush();

        expect(result.data()?.formats).toContain("webp");
        expect(result.data()?.parameters).toContain("quality");
    });

    it("does not fetch when disabled", async () => {
        expect.assertions(1);

        runInRoot(
            () =>
                createTransformMetadata({
                    enabled: false,
                    endpoint: "https://api.example.com/transform",
                }),
            queryClient,
        );

        await flush(30);

        expect(mockFetch).not.toHaveBeenCalled();
    });
});
