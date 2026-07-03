import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultFingerprint } from "../../src/core/fingerprint";
import { createTusAdapter } from "../../src/core/tus-adapter";
import { UploadControl } from "../../src/core/upload-control";
import { MemoryUrlStorage } from "../../src/core/url-storage";

const ENDPOINT = "http://localhost/api/upload/tus";

interface FetchArgs {
    body: BodyInit | null | undefined;
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

    return { body: init?.body, headers, method: init?.method, url };
};

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe("tus-adapter resume", () => {
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

    it("persists the uploadUrl to urlStorage after creating a new upload", async () => {
        expect.assertions(3);

        const urlStorage = new MemoryUrlStorage();
        const adapter = createTusAdapter({ chunkSize: 100, endpoint: ENDPOINT, urlStorage });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ Location: `${ENDPOINT}/abc123`, "Tus-Resumable": "1.0.0" }),
            ok: true,
            status: 201,
        });
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": "100" }),
            ok: true,
            status: 204,
        });
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

        // Mid-upload, the entry must exist so a crash leaves a resumable record.
        // We can't easily inspect during, so we inspect after the test: on success the
        // entry is removed, but we also verify addEntry was the persistence path used.
        const addSpy = vi.spyOn(urlStorage, "addEntry");
        const removeSpy = vi.spyOn(urlStorage, "removeEntry");

        await adapter.upload(file);

        expect(addSpy).toHaveBeenCalledTimes(1);
        expect(addSpy.mock.calls[0]?.[0]).toMatchObject({ protocol: "tus", uploadUrl: `${ENDPOINT}/abc123` });
        expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    it("skips POST and resumes when urlStorage has an entry for the fingerprint", async () => {
        expect.assertions(3);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "tus" });

        await urlStorage.addEntry({
            createdAt: Date.now(),
            endpoint: ENDPOINT,
            fingerprint,
            lastModified: file.lastModified,
            protocol: "tus",
            size: file.size,
            uploadUrl: `${ENDPOINT}/abc123`,
        });

        const adapter = createTusAdapter({ chunkSize: 100, endpoint: ENDPOINT, urlStorage });

        // 1. HEAD probe — server reports 50 bytes already uploaded.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": "50" }),
            ok: true,
            status: 200,
        });
        // 2. PATCH for the remaining 50 bytes.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": "100" }),
            ok: true,
            status: 204,
        });
        // 3. Final HEAD.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        await adapter.upload(file);

        const calls = mockFetch.mock.calls.map((call) => captureFetchCall(call));

        // No POST should have been made — only HEAD probe, PATCH, final HEAD.
        expect(calls.some((call) => call.method === "POST")).toBe(false);
        expect(calls[0]).toMatchObject({ method: "HEAD", url: `${ENDPOINT}/abc123` });
        // PATCH starts from offset 50, not 0.
        expect(calls.find((call) => call.method === "PATCH")?.headers["Upload-Offset"]).toBe("50");
    });

    it("falls through to POST when the persisted upload no longer exists on the server", async () => {
        expect.assertions(2);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "tus" });

        await urlStorage.addEntry({
            createdAt: Date.now(),
            endpoint: ENDPOINT,
            fingerprint,
            lastModified: file.lastModified,
            protocol: "tus",
            size: file.size,
            uploadUrl: `${ENDPOINT}/stale-id`,
        });

        const adapter = createTusAdapter({ chunkSize: 100, endpoint: ENDPOINT, urlStorage });

        // 1. HEAD probe — server says 410 Gone.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            ok: false,
            status: 410,
            statusText: "Gone",
        });
        // 2. POST create new upload.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ Location: `${ENDPOINT}/fresh-id`, "Tus-Resumable": "1.0.0" }),
            ok: true,
            status: 201,
        });
        // 3. PATCH.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": "100" }),
            ok: true,
            status: 204,
        });
        // 4. Final HEAD.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        await adapter.upload(file);

        const calls = mockFetch.mock.calls.map((call) => captureFetchCall(call));

        expect(calls[0]).toMatchObject({ method: "HEAD", url: `${ENDPOINT}/stale-id` });
        expect(calls.find((call) => call.method === "POST")?.url).toBe(ENDPOINT);
    });

    it("resumes from a snapshot supplied through UploadControl.from", async () => {
        expect.assertions(2);

        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "tus" });

        const control = UploadControl.from({
            endpoint: ENDPOINT,
            fingerprint,
            offset: 30,
            protocol: "tus",
            uploadUrl: `${ENDPOINT}/snap-id`,
            v: 1,
        });

        const adapter = createTusAdapter({ chunkSize: 100, control, endpoint: ENDPOINT });

        // 1. HEAD probe — 30 bytes already uploaded.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": "30" }),
            ok: true,
            status: 200,
        });
        // 2. PATCH.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": "100" }),
            ok: true,
            status: 204,
        });
        // 3. Final HEAD.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        await adapter.upload(file);

        const calls = mockFetch.mock.calls.map((call) => captureFetchCall(call));

        expect(calls.some((call) => call.method === "POST")).toBe(false);
        expect(calls[0]).toMatchObject({ method: "HEAD", url: `${ENDPOINT}/snap-id` });
    });

    it("attaches the supplied UploadControl with the eventual upload metadata", async () => {
        expect.assertions(5);

        const control = new UploadControl();
        const adapter = createTusAdapter({ chunkSize: 100, control, endpoint: ENDPOINT });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ Location: `${ENDPOINT}/new-id`, "Tus-Resumable": "1.0.0" }),
            ok: true,
            status: 201,
        });
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": "100" }),
            ok: true,
            status: 204,
        });
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

        await adapter.upload(file);

        // After a successful upload, control was attached (so endpoint/fingerprint/etc. are readable)
        // and offset advanced to 100. The binding has been detached, so pause/abort no-op.
        expect(control.endpoint).toBe(ENDPOINT);
        expect(control.uploadUrl).toBe(`${ENDPOINT}/new-id`);
        expect(control.protocol).toBe("tus");
        expect(control.offset).toBe(100);
        // toJSON() works after a successful upload — the snapshot fields are still set.
        expect(control.toJSON().uploadUrl).toBe(`${ENDPOINT}/new-id`);
    });

    it("preserves the urlStorage entry when the upload errors so retries can resume", async () => {
        expect.assertions(2);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "tus" });

        // POST succeeds, PATCH fails permanently (retry: false).
        const adapter = createTusAdapter({ chunkSize: 100, endpoint: ENDPOINT, retry: false, urlStorage });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ Location: `${ENDPOINT}/abc123`, "Tus-Resumable": "1.0.0" }),
            ok: true,
            status: 201,
        });
        mockFetch.mockResolvedValueOnce({
            headers: new Headers(),
            ok: false,
            status: 500,
            statusText: "Server Error",
        });

        await expect(adapter.upload(file)).rejects.toThrow(/Failed to upload chunk/);

        // Entry MUST still be there so the caller can retry from the saved fileId.
        const persisted = await urlStorage.findEntry(fingerprint);

        expect(persisted?.uploadUrl).toBe(`${ENDPOINT}/abc123`);
    });

    it("control.abort() during an in-flight upload triggers the abort path", async () => {
        expect.assertions(1);

        const control = new UploadControl();
        const adapter = createTusAdapter({ chunkSize: 100, control, endpoint: ENDPOINT });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ Location: `${ENDPOINT}/abc123`, "Tus-Resumable": "1.0.0" }),
            ok: true,
            status: 201,
        });

        // PATCH delays so we can abort mid-flight via the control.
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

        // Wait long enough for the POST to resolve and the PATCH to be in flight.
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 20);
        });

        control.abort();

        await expect(uploadPromise).rejects.toThrow(/abort/i);
    });

    it("control.pause() / control.resume() flip the adapter's paused flag", async () => {
        expect.assertions(2);

        const control = new UploadControl();
        const adapter = createTusAdapter({ chunkSize: 100, control, endpoint: ENDPOINT });

        let resolvePatch: ((value: Response) => void) | undefined;

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ Location: `${ENDPOINT}/abc123`, "Tus-Resumable": "1.0.0" }),
            ok: true,
            status: 201,
        });
        // First PATCH never resolves until we let it — pause() while it's in flight,
        // then resume() to ensure the binding's resume callback flips the flag back.
        mockFetch.mockImplementationOnce(
            async () =>
                new Promise<Response>((resolve) => {
                    resolvePatch = resolve;
                }),
        );
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const uploadPromise = adapter.upload(file);

        // Let the POST settle and the PATCH begin.
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 20);
        });

        control.pause();

        expect(adapter.isPaused()).toBe(true);

        await control.resume();

        expect(adapter.isPaused()).toBe(false);

        // Let the in-flight PATCH complete so the test cleans up.
        resolvePatch?.({
            headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": "100" }),
            ok: true,
            status: 204,
        } as Response);

        await uploadPromise;
    });

    it("treats a probe network failure as cache miss and creates a fresh upload", async () => {
        expect.assertions(2);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
        const fingerprint = defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "tus" });

        await urlStorage.addEntry({
            createdAt: Date.now(),
            endpoint: ENDPOINT,
            fingerprint,
            lastModified: file.lastModified,
            protocol: "tus",
            size: file.size,
            uploadUrl: `${ENDPOINT}/network-broken`,
        });

        const adapter = createTusAdapter({ chunkSize: 100, endpoint: ENDPOINT, urlStorage });

        // 1. HEAD probe — network error (fetch throws).
        mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));
        // 2. POST a fresh upload.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ Location: `${ENDPOINT}/fresh`, "Tus-Resumable": "1.0.0" }),
            ok: true,
            status: 201,
        });
        // 3. PATCH.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": "100" }),
            ok: true,
            status: 204,
        });
        // 4. Final HEAD.
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Tus-Resumable": "1.0.0",
                "Upload-Length": "100",
                "Upload-Offset": "100",
            }),
            ok: true,
            status: 200,
        });

        await adapter.upload(file);

        const calls = mockFetch.mock.calls.map((call) => captureFetchCall(call));

        expect(calls[0]).toMatchObject({ method: "HEAD", url: `${ENDPOINT}/network-broken` });
        expect(calls.find((call) => call.method === "POST")?.url).toBe(ENDPOINT);
    });
});
