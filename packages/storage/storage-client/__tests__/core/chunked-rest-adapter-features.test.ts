import { beforeEach, describe, expect, it, vi } from "vitest";

import { createChunkedRestAdapter } from "../../src/core/chunked-rest-adapter";

const mockFetch = vi.fn();

/**
 * Queues the five-request happy path (POST create, HEAD status, PATCH chunk,
 * HEAD final status, GET result) for a single-chunk upload of `size` bytes.
 */
const mockHappyPath = (fileId: string, size: number): void => {
    mockFetch.mockResolvedValueOnce({ headers: new Headers({ "X-Upload-ID": fileId }), ok: true });
    mockFetch.mockResolvedValueOnce({ headers: new Headers({ "X-Upload-Offset": "0" }), ok: true });
    mockFetch.mockResolvedValueOnce({ headers: new Headers({ "X-Upload-Offset": String(size) }), ok: true });
    mockFetch.mockResolvedValueOnce({ headers: new Headers({ "X-Upload-Offset": String(size) }), ok: true });
    mockFetch.mockResolvedValueOnce({
        json: async () => {
            return { id: fileId, status: "completed" };
        },
        ok: true,
    });
};

const headersOf = (call: unknown): Record<string, string> => {
    const [, init] = call as [string, RequestInit];

    return init.headers as Record<string, string>;
};

describe("chunked-rest adapter features", () => {
    beforeEach(() => {
        globalThis.fetch = mockFetch;
        vi.clearAllMocks();
    });

    it("should attach custom headers to every request", async () => {
        expect.assertions(2);

        const file = new File(["abc"], "a.txt", { type: "text/plain" });

        mockHappyPath("id-1", file.size);

        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
            headers: { Authorization: "Bearer token" },
        });

        await adapter.upload(file);

        // The POST create request carries the auth header.
        expect(headersOf(mockFetch.mock.calls[0]).Authorization).toBe("Bearer token");
        // So does the PATCH chunk request.
        expect(headersOf(mockFetch.mock.calls[2]).Authorization).toBe("Bearer token");
    });

    it("should attach onBeforeRequest hook headers, with protocol headers winning", async () => {
        expect.assertions(3);

        const file = new File(["abc"], "a.txt", { type: "text/plain" });

        mockHappyPath("id-hook", file.size);

        const seenMethods: string[] = [];

        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
            onBeforeRequest: ({ method }) => {
                seenMethods.push(method);

                // Attempt to override a protocol-required header — it must NOT win.
                return { Authorization: "Bearer dynamic", "X-Chunk-Offset": "999" };
            },
        });

        await adapter.upload(file);

        // The auth header from the hook reaches the PATCH chunk request.
        expect(headersOf(mockFetch.mock.calls[2]).Authorization).toBe("Bearer dynamic");
        // Protocol header set by the adapter wins over the hook's attempted override.
        expect(headersOf(mockFetch.mock.calls[2])["X-Chunk-Offset"]).toBe("0");
        // The hook saw the real request methods.
        expect(seenMethods).toContain("PATCH");
    });

    it("should emit RFC 5987 Content-Disposition for unicode filenames", async () => {
        expect.assertions(2);

        const file = new File(["abc"], "résumé \"final\".pdf", { type: "application/pdf" });

        mockHappyPath("id-2", file.size);

        const adapter = createChunkedRestAdapter({ endpoint: "https://api.example.com/upload" });

        await adapter.upload(file);

        const disposition = headersOf(mockFetch.mock.calls[0])["Content-Disposition"];

        // ASCII fallback must not contain a raw quote that would break the header.
        expect(disposition).toContain("filename*=UTF-8''");
        expect(disposition).toContain(encodeURIComponent("résumé \"final\".pdf"));
    });

    it("should send a per-chunk checksum when enabled", async () => {
        expect.assertions(1);

        const file = new File(["chunk-data"], "c.bin", { type: "application/octet-stream" });

        mockHappyPath("id-3", file.size);

        const adapter = createChunkedRestAdapter({
            checksum: true,
            endpoint: "https://api.example.com/upload",
        });

        await adapter.upload(file);

        const patchHeaders = headersOf(mockFetch.mock.calls[2]);

        expect(patchHeaders["X-Chunk-Checksum"]).toMatch(/^[\da-f]{64}$/);
    });

    it("should reject files that violate restrictions before any request", async () => {
        expect.assertions(2);

        const file = new File([new Uint8Array(100)], "big.bin");

        const adapter = createChunkedRestAdapter({
            endpoint: "https://api.example.com/upload",
            restrictions: { maxFileSize: 50 },
        });

        await expect(adapter.upload(file)).rejects.toThrow(/too large/i);
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
