import { QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHeadFile } from "../../src/vue/use-head-file";
import { waitForReady, withQueryClient } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(useHeadFile, () => {
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

    it("should fetch file metadata via HEAD request", async () => {
        expect.assertions(2);

        const mockHeaders = new Headers({
            "Content-Length": "1024",
            "Content-Type": "image/jpeg",
        });

        mockFetch.mockResolvedValueOnce({
            headers: mockHeaders,
            ok: true,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            queryClient,
        );

        await waitForReady(() => !result.isLoading.value);

        expect(result.isLoading.value).toBe(false);
        expect(result.data.value?.contentLength).toBe(1024);

        unmount();
    });

    it("should extract upload metadata", async () => {
        expect.assertions(3);

        const mockHeaders = new Headers({
            "X-Chunked-Upload": "true",
            "X-Upload-Complete": "false",
            "X-Upload-Offset": "500",
        });

        mockFetch.mockResolvedValueOnce({
            headers: mockHeaders,
            ok: true,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            queryClient,
        );

        await waitForReady(() => result.data.value?.uploadOffset !== undefined);

        expect(result.data.value?.uploadOffset).toBe(500);
        expect(result.data.value?.chunkedUpload).toBe(true);
        expect(result.data.value?.uploadComplete).toBe(false);

        unmount();
    });

    it("should parse received chunks", async () => {
        expect.assertions(1);

        const mockHeaders = new Headers({
            "X-Received-Chunks": JSON.stringify([0, 1024, 2048]),
        });

        mockFetch.mockResolvedValueOnce({
            headers: mockHeaders,
            ok: true,
        });

        const { result, unmount } = withQueryClient(
            () =>
                useHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            queryClient,
        );

        await waitForReady(() => Array.isArray(result.data.value?.receivedChunks));

        expect(result.data.value?.receivedChunks).toStrictEqual([0, 1024, 2048]);

        unmount();
    });

    it("should respect enabled option", () => {
        expect.assertions(2);

        const { result, unmount } = withQueryClient(
            () =>
                useHeadFile({
                    enabled: false,
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            queryClient,
        );

        expect(result.isLoading.value).toBe(false);
        expect(result.data.value).toBeUndefined();

        unmount();
    });

    it("should not fetch when id is empty", () => {
        expect.assertions(2);

        const { result, unmount } = withQueryClient(
            () =>
                useHeadFile({
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
