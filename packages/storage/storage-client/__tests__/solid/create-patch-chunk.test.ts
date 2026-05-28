import { QueryClient } from "@tanstack/solid-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPatchChunk } from "../../src/solid/create-patch-chunk";
import { runInRoot } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(createPatchChunk, () => {
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

    it("uploads a chunk and exposes the next offset", async () => {
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

        const result = runInRoot(
            () =>
                createPatchChunk({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        const uploaded = await result.patchChunk("file-123", chunk, 0);

        expect(uploaded.offset).toBe(100);
        expect(uploaded.metadata?.etag).toBe("\"chunk-etag\"");
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

        const result = runInRoot(
            () =>
                createPatchChunk({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        const uploaded = await result.patchChunk("file-123", chunk, 0);

        expect(uploaded.status).toBe("completed");
    });
});
