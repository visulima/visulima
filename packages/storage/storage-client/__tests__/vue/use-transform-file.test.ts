import { QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTransformFile } from "../../src/vue/use-transform-file";
import { waitForReady, withQueryClient } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(useTransformFile, () => {
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

    it("returns the transformed blob and header metadata", async () => {
        expect.assertions(2);

        const mockBlob = new Blob(["transformed content"], { type: "image/jpeg" });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({
                "Content-Length": "18",
                "Content-Type": "image/jpeg",
            }),
            ok: true,
            status: 200,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useTransformFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    transform: { height: 600, width: 800 },
                }),
            queryClient,
        );

        await waitForReady(() => result.data.value !== undefined);

        expect(result.data.value).toBeInstanceOf(Blob);
        expect(result.meta.value?.contentType).toBe("image/jpeg");

        unmount();
    });

    it("surfaces a typed error when the server replies with an error body", async () => {
        expect.assertions(1);

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return { error: { code: "RequestFailed", message: "Transform failed" } };
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        const { result, unmount } = withQueryClient(
            () =>
                useTransformFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    transform: { width: 800 },
                }),
            queryClient,
        );

        await waitForReady(() => result.error.value !== undefined);

        expect(result.error.value?.message).toBe("Transform failed");

        unmount();
    });

    it("does not fetch when id is empty", () => {
        expect.assertions(1);

        const { unmount } = withQueryClient(
            () =>
                useTransformFile({
                    endpoint: "https://api.example.com",
                    id: "",
                    transform: { width: 800 },
                }),
            queryClient,
        );

        expect(mockFetch).not.toHaveBeenCalled();

        unmount();
    });
});
