import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChunkedRestAdapter } from "../../src/core/chunked-rest-adapter";
import { defaultFingerprint } from "../../src/core/fingerprint";
import { UploadControl } from "../../src/core/upload-control";
import { MemoryUrlStorage } from "../../src/core/url-storage";

const ENDPOINT = "http://localhost/api/upload/chunked";

interface FetchArgs {
    headers: Record<string, string>;
    method: string | undefined;
    url: string;
}

const captureFetchCall = (call: unknown[]): FetchArgs => {
    const [url, init] = call as [string, RequestInit | undefined];
    const headersInit = init?.headers ?? {};
    const headers: Record<string, string> = {};

    if (headersInit instanceof Headers) {
        headersInit.forEach((value, key) => {
            headers[key] = value;
        });
    } else if (Array.isArray(headersInit)) {
        for (const [key, value] of headersInit) {
            headers[key] = value;
        }
    } else {
        Object.assign(headers, headersInit);
    }

    return { headers, method: init?.method, url };
};

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe("chunked-rest-adapter resume", () => {
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

    it("persists fileId to urlStorage after creating a new upload and clears it on success", async () => {
        expect.assertions(3);

        const urlStorage = new MemoryUrlStorage();
        const addSpy = vi.spyOn(urlStorage, "addEntry");
        const removeSpy = vi.spyOn(urlStorage, "removeEntry");
        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, urlStorage });

        // 1. POST — create session
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-ID": "file-123" }),
            ok: true,
        });
        // 2. HEAD — initial status (performUpload)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "0" }),
            ok: true,
        });
        // 3. PATCH — chunk
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 4. HEAD — final status check
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 5. GET — result
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            json: async () => {
                return { id: "file-123", size: 100, status: "completed" };
            },
            ok: true,
        });

        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

        await adapter.upload(file);

        expect(addSpy).toHaveBeenCalledTimes(1);
        expect(addSpy.mock.calls[0]?.[0]).toMatchObject({ protocol: "chunked-rest", uploadUrl: "file-123" });
        expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    it("skips POST and resumes when urlStorage has an entry for the fingerprint", async () => {
        expect.assertions(2);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "chunked-rest" });

        await urlStorage.addEntry({
            createdAt: Date.now(),
            endpoint: ENDPOINT,
            fingerprint,
            lastModified: file.lastModified,
            protocol: "chunked-rest",
            size: file.size,
            uploadUrl: "existing-id",
        });

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, urlStorage });

        // 1. HEAD probe — confirms upload exists, 50 bytes uploaded
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "50" }),
            ok: true,
        });
        // 2. HEAD status (start of performUpload) — report 50 bytes via X-Received-Chunks
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Received-Chunks": JSON.stringify([{ length: 100, offset: 0 }]), "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 3. HEAD final status check
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 4. GET result
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            json: async () => {
                return { id: "existing-id", size: 100, status: "completed" };
            },
            ok: true,
        });

        await adapter.upload(file);

        const calls = mockFetch.mock.calls.map((call) => captureFetchCall(call));

        expect(calls.some((call) => call.method === "POST")).toBe(false);
        expect(calls[0]).toMatchObject({ method: "HEAD", url: `${ENDPOINT}/existing-id` });
    });

    it("falls through to POST when the persisted upload no longer exists on the server", async () => {
        expect.assertions(2);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "chunked-rest" });

        await urlStorage.addEntry({
            createdAt: Date.now(),
            endpoint: ENDPOINT,
            fingerprint,
            lastModified: file.lastModified,
            protocol: "chunked-rest",
            size: file.size,
            uploadUrl: "stale-id",
        });

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false, urlStorage });

        // 1. HEAD probe — 404 Gone
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            ok: false,
            status: 404,
            statusText: "Not Found",
        });
        // 2. POST — new upload created
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-ID": "fresh-id" }),
            ok: true,
        });
        // 3. HEAD initial status
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "0" }),
            ok: true,
        });
        // 4. PATCH chunk
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 5. HEAD final status
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 6. GET result
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            json: async () => {
                return { id: "fresh-id", size: 100, status: "completed" };
            },
            ok: true,
        });

        await adapter.upload(file);

        const calls = mockFetch.mock.calls.map((call) => captureFetchCall(call));

        expect(calls[0]).toMatchObject({ method: "HEAD", url: `${ENDPOINT}/stale-id` });
        expect(calls.find((call) => call.method === "POST")?.url).toBe(ENDPOINT);
    });

    it("resumes from a snapshot supplied through UploadControl.from", async () => {
        expect.assertions(3);

        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "chunked-rest" });

        const control = UploadControl.from({
            endpoint: ENDPOINT,
            fingerprint,
            offset: 0,
            protocol: "chunked-rest",
            uploadUrl: "snap-id",
            v: 1,
        });

        const adapter = createChunkedRestAdapter({ chunkSize: 100, control, endpoint: ENDPOINT });

        // 1. HEAD probe
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "0" }),
            ok: true,
        });
        // 2. HEAD initial status
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "0" }),
            ok: true,
        });
        // 3. PATCH
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 4. HEAD final
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 5. GET result
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            json: async () => {
                return { id: "snap-id", size: 100, status: "completed" };
            },
            ok: true,
        });

        await adapter.upload(file);

        const calls = mockFetch.mock.calls.map((call) => captureFetchCall(call));

        expect(calls.some((call) => call.method === "POST")).toBe(false);
        expect(calls[0]).toMatchObject({ method: "HEAD", url: `${ENDPOINT}/snap-id` });
        expect(control.uploadUrl).toBe("snap-id");
    });

    it("reports the probed offset on resume via the supplied UploadControl", async () => {
        expect.assertions(1);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "chunked-rest" });

        await urlStorage.addEntry({
            createdAt: Date.now(),
            endpoint: ENDPOINT,
            fingerprint,
            lastModified: file.lastModified,
            protocol: "chunked-rest",
            size: file.size,
            uploadUrl: "resumed-id",
        });

        const control = new UploadControl();
        const adapter = createChunkedRestAdapter({ chunkSize: 100, control, endpoint: ENDPOINT, urlStorage });

        // 1. HEAD probe reports 70 bytes already on the server.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "70" }),
            ok: true,
        });
        // 2. HEAD status — performUpload then reports it as a received chunk too.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Received-Chunks": JSON.stringify([{ length: 100, offset: 0 }]), "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 3. Final HEAD.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 4. GET result.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            json: async () => {
                return { id: "resumed-id", size: 100, status: "completed" };
            },
            ok: true,
        });

        // Spy the control mid-resume to observe the post-probe offset. The simplest
        // observation point: after upload completes, the offset must reflect either
        // the probed 70 (early) or the 100 reported by uploadChunk (later). We only
        // care that the probe value got propagated at least once — verify by snooping.
        let observedAfterProbe = -1;
        const originalUpdate = control._updateOffset.bind(control);

        (control as any)._updateOffset = (offset: number): void => {
            if (observedAfterProbe === -1) {
                observedAfterProbe = offset;
            }

            originalUpdate(offset);
        };

        await adapter.upload(file);

        // The very first _updateOffset call must come from the post-probe propagation
        // (the regression we just fixed). Without the fix, the first call comes from
        // uploadChunk and would report 100, not 70.
        expect(observedAfterProbe).toBe(70);
    });

    it("preserves the urlStorage entry when the upload errors so retries can resume", async () => {
        expect.assertions(2);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "chunked-rest" });

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false, urlStorage });

        // 1. POST creates the session.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-ID": "file-keep-me" }),
            ok: true,
        });
        // 2. HEAD status — initial.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "0" }),
            ok: true,
        });
        // 3. PATCH fails (500). With retry: false this propagates.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            ok: false,
            status: 500,
            statusText: "Server Error",
        });

        await expect(adapter.upload(file)).rejects.toThrow(/Failed to upload chunk/);

        const persisted = await urlStorage.findEntry(fingerprint);

        expect(persisted?.uploadUrl).toBe("file-keep-me");
    });

    it("control.abort() during an in-flight upload triggers the abort path", async () => {
        expect.assertions(1);

        const control = new UploadControl();
        const adapter = createChunkedRestAdapter({ chunkSize: 100, control, endpoint: ENDPOINT, retry: false });

        // 1. POST returns fileId.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-ID": "file-abort" }),
            ok: true,
        });
        // 2. HEAD status — initial.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "0" }),
            ok: true,
        });
        // 3. PATCH hangs until the signal fires.
        mockFetch.mockImplementationOnce(
            async (_url: string, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () => {
                        const error = new Error("Aborted");

                        error.name = "AbortError";
                        reject(error);
                    });
                }),
        );

        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const uploadPromise = adapter.upload(file);

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 20);
        });

        control.abort();

        await expect(uploadPromise).rejects.toThrow(/abort/i);
    });

    it("control.pause() / control.resume() flip the adapter's paused flag", async () => {
        expect.assertions(2);

        const control = new UploadControl();
        const adapter = createChunkedRestAdapter({ chunkSize: 100, control, endpoint: ENDPOINT });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-ID": "file-pause" }),
            ok: true,
        });
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "0" }),
            ok: true,
        });

        let resolvePatch: ((value: Response) => void) | undefined;

        mockFetch.mockImplementationOnce(
            async () =>
                new Promise<Response>((resolve) => {
                    resolvePatch = resolve;
                }),
        );
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            json: async () => {
                return { id: "file-pause", size: 100, status: "completed" };
            },
            ok: true,
        });

        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const uploadPromise = adapter.upload(file);

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 20);
        });

        control.pause();

        expect(adapter.isPaused()).toBe(true);

        await control.resume();

        expect(adapter.isPaused()).toBe(false);

        resolvePatch?.({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        } as Response);

        await uploadPromise;
    });

    it("treats a probe network failure as cache miss and creates a fresh session", async () => {
        expect.assertions(2);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "chunked-rest" });

        await urlStorage.addEntry({
            createdAt: Date.now(),
            endpoint: ENDPOINT,
            fingerprint,
            lastModified: file.lastModified,
            protocol: "chunked-rest",
            size: file.size,
            uploadUrl: "stale-id",
        });

        const adapter = createChunkedRestAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false, urlStorage });

        // 1. HEAD probe — network error.
        mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));
        // 2. POST a new session.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-ID": "fresh-id" }),
            ok: true,
        });
        // 3. HEAD initial status.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "0" }),
            ok: true,
        });
        // 4. PATCH.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 5. HEAD final status.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "X-Upload-Offset": "100" }),
            ok: true,
        });
        // 6. GET result.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            json: async () => {
                return { id: "fresh-id", size: 100, status: "completed" };
            },
            ok: true,
        });

        await adapter.upload(file);

        const calls = mockFetch.mock.calls.map((call) => captureFetchCall(call));

        expect(calls[0]).toMatchObject({ method: "HEAD", url: `${ENDPOINT}/stale-id` });
        expect(calls.find((call) => call.method === "POST")?.url).toBe(ENDPOINT);
    });
});
