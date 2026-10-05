import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChunkedRestAdapter } from "../../src/core/chunked-rest-adapter";
import { defaultFingerprint } from "../../src/core/fingerprint";
import { MemoryUrlStorage } from "../../src/core/url-storage";

const ENDPOINT = "http://localhost/api/upload/chunked";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

const respond = (headers: Record<string, string> = {}, status = 200): Response =>
    ({
        headers: new Headers(headers),
        json: async () => {
            return { id: "file-1", status: "completed" };
        },
        ok: status >= 200 && status < 300,
        status,
        statusText: "",
    }) as Response;

const abortError = (): Error => new DOMException("Aborted", "AbortError");

/** Resolves with `response` after `ms`, or rejects as soon as the request's signal aborts. */
const delayed = async (init: RequestInit | undefined, ms: number, response: Response): Promise<Response> =>
    new Promise<Response>((resolve, reject) => {
        if (init?.signal?.aborted) {
            reject(abortError());

            return;
        }

        const timer = setTimeout(() => {
            resolve(response);
        }, ms);

        init?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(abortError());
        });
    });

const calls = (): { headers: Record<string, string>; method: string; signal: AbortSignal | undefined }[] =>
    mockFetch.mock.calls.map((call: unknown[]) => {
        const [, init] = call as [string, RequestInit | undefined];

        return { headers: (init?.headers ?? {}) as Record<string, string>, method: init?.method ?? "GET", signal: init?.signal ?? undefined };
    });

const patches = (): ReturnType<typeof calls> => calls().filter(({ method }) => method === "PATCH");

const sleep = async (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

describe("chunked-rest adapter robustness", () => {
    beforeEach(() => {
        originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch;
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    afterEach(() => {
        if (originalFetch) {
            globalThis.fetch = originalFetch;
        } else {
            delete (globalThis as { fetch?: typeof fetch }).fetch;
        }

        vi.restoreAllMocks();
    });

    it("stops the sibling workers when one chunk fails", async () => {
        expect.assertions(3);

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false });

        mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
            const headers = (init?.headers ?? {}) as Record<string, string>;

            switch (init?.method) {
                case "PATCH": {
                    return headers["X-Chunk-Offset"] === "0" ? respond({}, 413) : delayed(init, 20, respond());
                }
                case "POST": {
                    return respond({ "X-Upload-ID": "file-1" });
                }
                default: {
                    return respond({ "X-Upload-Offset": "0" });
                }
            }
        });

        // Eight chunks, the first refused.
        await expect(adapter.upload(new File(["x".repeat(800)], "a.bin"))).rejects.toThrow(/Failed to upload chunk/);

        // Give any still-running worker the chance to send its next chunk.
        await sleep(100);

        expect(patches().length).toBeLessThanOrEqual(4);
        expect(patches().every(({ signal }) => signal?.aborted)).toBe(true);
    });

    it("sends one chunk at a time", async () => {
        expect.assertions(2);

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false });
        let inFlight = 0;
        let maxInFlight = 0;

        mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
            switch (init?.method) {
                case "PATCH": {
                    inFlight += 1;
                    maxInFlight = Math.max(maxInFlight, inFlight);

                    return delayed(init, 5, respond()).finally(() => {
                        inFlight -= 1;
                    });
                }
                case "POST": {
                    return respond({ "X-Upload-ID": "file-1" });
                }
                default: {
                    return respond({ "X-Upload-Offset": "400" });
                }
            }
        });

        await adapter.upload(new File(["x".repeat(400)], "a.bin"));

        // The server answers a PATCH that overlaps another with 423 Locked, and S3 only appends.
        expect(patches()).toHaveLength(4);
        expect(maxInFlight).toBe(1);
    });

    it("rejects with \"Upload aborted\" when aborted while a chunk is in flight", async () => {
        expect.assertions(1);

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false });

        mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
            switch (init?.method) {
                case "PATCH": {
                    return delayed(init, 1000, respond());
                }
                case "POST": {
                    return respond({ "X-Upload-ID": "file-1" });
                }
                default: {
                    return respond({ "X-Upload-Offset": "0" });
                }
            }
        });

        const uploadPromise = adapter.upload(new File(["x".repeat(200)], "a.bin"));

        await vi.waitFor(
            () => {
                if (patches().length === 0) {
                    throw new Error("no PATCH sent yet");
                }
            },
            { interval: 1 },
        );

        adapter.abort();

        // Not the fetch's own AbortError.
        await expect(uploadPromise).rejects.toThrow("Upload aborted");
    });

    it("clear() aborts the running upload so it reports no further progress", async () => {
        expect.assertions(2);

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false });
        const onProgress = vi.fn();

        adapter.setOnProgress(onProgress);

        mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
            switch (init?.method) {
                case "PATCH": {
                    return delayed(init, 20, respond());
                }
                case "POST": {
                    return respond({ "X-Upload-ID": "file-1" });
                }
                default: {
                    return respond({ "X-Upload-Offset": "0" });
                }
            }
        });

        const uploadPromise = adapter.upload(new File(["x".repeat(200)], "a.bin"));

        await vi.waitFor(
            () => {
                if (patches().length === 0) {
                    throw new Error("no PATCH sent yet");
                }
            },
            { interval: 1 },
        );

        adapter.clear();

        await expect(uploadPromise).rejects.toThrow(/abort/i);

        expect(onProgress).not.toHaveBeenCalled();
    });

    it("never reports progress moving backwards when chunks finish out of order", async () => {
        expect.assertions(1);

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false });
        const progress: number[] = [];

        adapter.setOnProgress((value) => {
            progress.push(value);
        });

        mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
            const headers = (init?.headers ?? {}) as Record<string, string>;

            switch (init?.method) {
                case "PATCH": {
                    // No X-Upload-Offset; the first chunk lands after the second.
                    return delayed(init, headers["X-Chunk-Offset"] === "0" ? 30 : 5, respond());
                }
                case "POST": {
                    return respond({ "X-Upload-ID": "file-1" });
                }
                default: {
                    return respond({ "X-Upload-Offset": progress.length === 2 ? "200" : "0" });
                }
            }
        });

        await adapter.upload(new File(["x".repeat(200)], "a.bin"));

        expect(progress).toStrictEqual([50, 100]);
    });

    it("uploads a 0-byte file", async () => {
        expect.assertions(2);

        const adapter = createChunkedRestAdapter({ endpoint: ENDPOINT, retry: false });

        mockFetch.mockImplementation(async (_url: string, init?: RequestInit) =>
            init?.method === "POST" ? respond({ "X-Upload-ID": "file-1" }) : respond({ "X-Upload-Offset": "0" }),
        );

        const result = await adapter.upload(new File([], "empty.txt"));

        expect(result.id).toBe("file-1");
        expect(patches()).toHaveLength(0);
    });

    it("does not report an upload complete when the final offset is malformed", async () => {
        expect.assertions(1);

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false });
        let heads = 0;

        mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
            switch (init?.method) {
                case "HEAD": {
                    heads += 1;

                    return respond({ "X-Upload-Offset": heads === 1 ? "0" : "garbage" });
                }
                case "PATCH": {
                    return respond();
                }
                default: {
                    return respond({ "X-Upload-ID": "file-1" });
                }
            }
        });

        await expect(adapter.upload(new File(["x".repeat(100)], "a.bin"))).rejects.toThrow(/Upload incomplete/);
    });

    it("re-probes a stored upload after a transient 5xx instead of failing", async () => {
        expect.assertions(1);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "a.bin");

        await urlStorage.addEntry({
            createdAt: Date.now(),
            endpoint: ENDPOINT,
            fingerprint: defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "chunked-rest" }),
            lastModified: file.lastModified,
            protocol: "chunked-rest",
            size: file.size,
            uploadUrl: "stored-id",
        });

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, maxRetries: 1, urlStorage });

        mockFetch.mockResolvedValueOnce(respond({}, 503));
        mockFetch.mockResolvedValueOnce(respond({ "X-Upload-Offset": "0" }));
        mockFetch.mockResolvedValueOnce(respond({ "X-Upload-Offset": "0" }));
        mockFetch.mockResolvedValueOnce(respond({ "X-Upload-Complete": "true", "X-Upload-Offset": "100" }));

        await adapter.upload(file);

        expect(calls().map(({ method }) => method)).toStrictEqual(["HEAD", "HEAD", "HEAD", "PATCH"]);
    }, 10_000);

    it("rejects with the timeout error when the inactivity timeout fires", async () => {
        expect.assertions(2);

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false, uploadTimeoutMs: 50 });
        const onError = vi.fn();

        adapter.setOnError(onError);

        mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
            switch (init?.method) {
                case "PATCH": {
                    return delayed(init, 10_000, respond());
                }
                case "POST": {
                    return respond({ "X-Upload-ID": "file-1" });
                }
                default: {
                    return respond({ "X-Upload-Offset": "0" });
                }
            }
        });

        await expect(adapter.upload(new File(["x".repeat(100)], "a.bin"))).rejects.toThrow("Upload timeout");

        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Upload timeout" }));
    });

    it("passes the abort signal to the create and status requests", async () => {
        expect.assertions(1);

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false });

        mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
            switch (init?.method) {
                case "PATCH": {
                    return respond({ "X-Upload-Complete": "true", "X-Upload-Offset": "100" });
                }
                case "POST": {
                    return respond({ "X-Upload-ID": "file-1" });
                }
                default: {
                    return respond({ "X-Upload-Offset": "0" });
                }
            }
        });

        await adapter.upload(new File(["x".repeat(100)], "a.bin"));

        expect(calls().map(({ method, signal }) => [method, signal instanceof AbortSignal])).toStrictEqual([
            ["POST", true],
            ["HEAD", true],
            ["PATCH", true],
        ]);
    });

    // The hooks hear failures only through the error callback, so a restriction error thrown
    // before any request never reached their onError.
    it("reports a restriction error through the error callback before any request", async () => {
        expect.assertions(3);

        const fetchSpy = vi.fn<typeof fetch>();

        vi.stubGlobal("fetch", fetchSpy);

        const adapter = createChunkedRestAdapter({ endpoint: "https://api.example.com/files", restrictions: { maxFileSize: 1 } });
        const onError = vi.fn<(error: Error) => void>();

        adapter.setOnError(onError);

        await expect(adapter.upload(new File(["too big"], "a.txt"))).rejects.toThrow("is too large");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(fetchSpy).not.toHaveBeenCalled();

        vi.unstubAllGlobals();
    });
});
