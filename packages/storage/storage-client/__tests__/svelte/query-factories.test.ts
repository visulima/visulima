import { waitFor } from "@testing-library/svelte";
import { get, writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBatchDeleteFiles } from "../../src/svelte/create-batch-delete-files";
import { createGetFileList } from "../../src/svelte/create-get-file-list";
import { createGetFileMeta } from "../../src/svelte/create-get-file-meta";
import { createPatchChunk } from "../../src/svelte/create-patch-chunk";
import { createPutFile } from "../../src/svelte/create-put-file";
import { createTransformFile } from "../../src/svelte/create-transform-file";
import { createTransformMetadata } from "../../src/svelte/create-transform-metadata";
import { MockXMLHttpRequest } from "../mock-xhr";
import { mountFactory } from "./test-utils";

const endpoint = "https://api.example.com";
const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { headers: { "Content-Type": "application/json" }, status });

// The factories bridge svelte-query v6's rune-reactive results to stores; these tests drive the
// real factories so a store that never leaves its initial value fails them.
describe("svelte query factories", () => {
    beforeEach(() => {
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

    it("createGetFileMeta exposes the fetched metadata", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce(jsonResponse({ id: "file-123", name: "a.jpg" }));

        const result = mountFactory(() => createGetFileMeta({ endpoint, id: "file-123" }));

        await waitFor(() => {
            expect(get(result.data)?.name).toBe("a.jpg");
        });

        expect(get(result.isLoading)).toBe(false);
    });

    it("createGetFileMeta exposes the request error", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce(jsonResponse({ error: { code: "NotFound", message: "File not found" } }, 404));

        const result = mountFactory(() => createGetFileMeta({ endpoint, id: "missing" }));

        await waitFor(() => {
            expect(get(result.error)?.message).toBe("File not found");
        });
    });

    it("createGetFileList exposes the list and refetches when the page store changes", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "a" }])).mockResolvedValueOnce(jsonResponse([{ id: "b" }]));

        const page = writable(1);
        const result = mountFactory(() => createGetFileList({ endpoint, page }));

        await waitFor(() => {
            expect(get(result.data)?.data[0]?.id).toBe("a");
        });

        page.set(2);

        await waitFor(() => {
            expect(get(result.data)?.data[0]?.id).toBe("b");
        });
    });

    it("createTransformFile exposes the transformed blob and meta", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce(new Response(new Blob(["webp!"]), { headers: { "Content-Type": "image/webp" } }));

        const result = mountFactory(() => createTransformFile({ endpoint, id: "file-123", transform: { format: "webp", width: 10 } }));

        await waitFor(() => {
            expect(get(result.data)?.size).toBe(5);
        });

        expect(get(result.meta)?.contentType).toBe("image/webp");
    });

    it("createTransformMetadata exposes the formats", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce(jsonResponse({ formats: ["webp"], parameters: ["width"] }));

        const result = mountFactory(() => createTransformMetadata({ endpoint }));

        await waitFor(() => {
            expect(get(result.data)?.formats).toStrictEqual(["webp"]);
        });
    });

    it("createBatchDeleteFiles exposes the error and clears it on reset", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce(jsonResponse({ error: { code: "Forbidden", message: "Nope" } }, 403));

        const result = mountFactory(() => createBatchDeleteFiles({ endpoint }));

        await expect(result.batchDeleteFiles(["a", "b"])).rejects.toThrow("Nope");

        await waitFor(() => {
            expect(get(result.error)?.message).toBe("Nope");
        });

        result.reset();

        await waitFor(() => {
            expect(get(result.error)).toBeUndefined();
        });
    });

    it("createPatchChunk exposes the chunk result", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce(new Response(undefined, { headers: { "X-Upload-Offset": "10" }, status: 200 }));

        const result = mountFactory(() => createPatchChunk({ endpoint }));

        await result.patchChunk("file-123", new Blob(["0123456789"]), 0);

        await waitFor(() => {
            expect(get(result.data)?.offset).toBe(10);
        });

        expect(get(result.isLoading)).toBe(false);
    });

    describe(createPutFile, () => {
        let originalXHR: typeof XMLHttpRequest;

        beforeEach(() => {
            originalXHR = globalThis.XMLHttpRequest;
            globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
        });

        afterEach(() => {
            globalThis.XMLHttpRequest = originalXHR;
        });

        it("exposes the upload result", async () => {
            expect.hasAssertions();

            const result = mountFactory(() => createPutFile({ endpoint }));

            await result.putFile("file-123", new Blob(["data"]));

            await waitFor(() => {
                expect(get(result.data)?.id).toBe("file-123");
            });

            expect(get(result.isLoading)).toBe(false);
        });
    });
});
