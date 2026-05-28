import { QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePatchChunk } from "../../src/vue/use-patch-chunk";
import { withQueryClient } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(usePatchChunk, () => {
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

    it("uploads a chunk and exposes offset/etag", async () => {
        expect.assertions(2);

        const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                ETag: "\"chunk-etag\"",
                "X-Upload-Complete": "false",
                "X-Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        const { result, unmount } = withQueryClient(
            () =>
                usePatchChunk({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        const uploaded = await result.patchChunk("file-123", chunk, 0);

        expect(uploaded.offset).toBe(100);
        expect(uploaded.metadata?.etag).toBe("\"chunk-etag\"");

        unmount();
    });

    it("marks the upload as completed when the server signals it", async () => {
        expect.assertions(1);

        const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Complete": "true",
                "X-Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        const { result, unmount } = withQueryClient(
            () =>
                usePatchChunk({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        const uploaded = await result.patchChunk("file-123", chunk, 0);

        expect(uploaded.status).toBe("completed");

        unmount();
    });

    it("forwards the checksum header when provided", async () => {
        expect.assertions(1);

        const chunk = new Blob(["chunk data"], { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        const { result, unmount } = withQueryClient(
            () =>
                usePatchChunk({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await result.patchChunk("file-123", chunk, 0, "sha256:abcd");

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("file-123"),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "X-Chunk-Checksum": "sha256:abcd",
                }) as Record<string, string>,
                method: "PATCH",
            }),
        );

        unmount();
    });
});
