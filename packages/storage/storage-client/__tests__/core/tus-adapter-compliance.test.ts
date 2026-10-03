import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultFingerprint } from "../../src/core/fingerprint";
import { createTusAdapter } from "../../src/core/tus-adapter";
import { UploadControl } from "../../src/core/upload-control";
import { MemoryUrlStorage } from "../../src/core/url-storage";

const ENDPOINT = "http://localhost/api/upload/tus";

interface RecordedRequest {
    headers: Record<string, string>;
    method: string;
    url: string;
}

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

const requests = (): RecordedRequest[] =>
    mockFetch.mock.calls.map((call: unknown[]) => {
        const [url, init] = call as [string, RequestInit | undefined];

        return { headers: (init?.headers ?? {}) as Record<string, string>, method: init?.method ?? "GET", url };
    });

const created = (location: string): Partial<Response> => {
    return { headers: new Headers({ Location: location, "Tus-Resumable": "1.0.0" }), ok: true, status: 201 };
};

const patched = (offset: number): Partial<Response> => {
    return { headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset) }), ok: true, status: 204 };
};

const headOk = (offset: number): Partial<Response> => {
    return { headers: new Headers({ "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset) }), ok: true, status: 200 };
};

const failed = (status: number): Partial<Response> => {
    return { headers: new Headers({ "Tus-Resumable": "1.0.0" }), ok: false, status, statusText: "" };
};

/** A PATCH that only settles (by rejecting) once its signal aborts. */
const hangingUntilAborted = (init: RequestInit | undefined): Promise<Response> =>
    new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
        });
    });

const waitFor = async (predicate: () => boolean): Promise<void> => {
    for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) {
        // eslint-disable-next-line no-promise-executor-return -- polling a mock in a test
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }
};

describe("tus-adapter protocol compliance", () => {
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

    describe("upload-Metadata keys", () => {
        it.each([
            ["", "must not be empty"],
            ["bad key", "must not contain spaces or commas"],
            ["a,b", "must not contain spaces or commas"],
            ["tab\tkey", "must not contain spaces or commas"],
        ])("rejects the invalid key %j before any request", async (key, message) => {
            expect.assertions(2);

            const adapter = createTusAdapter({ endpoint: ENDPOINT, metadata: { [key]: "value" } });
            const file = new File(["x"], "test.bin", { type: "application/octet-stream" });

            await expect(adapter.upload(file)).rejects.toThrow(message);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("sends a bare key for an empty value", async () => {
            expect.assertions(1);

            const adapter = createTusAdapter({ endpoint: ENDPOINT, metadata: { note: "" } });

            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/abc`));
            mockFetch.mockResolvedValueOnce(patched(1));
            mockFetch.mockResolvedValueOnce(headOk(1));

            // No MIME type, so `filetype` is empty as well.
            await adapter.upload(new File(["x"], "a.bin"));

            expect(requests()[0]?.headers["Upload-Metadata"]).toBe(`filename ${btoa("a.bin")},filetype,note`);
        });
    });

    describe("upload resource gone mid-upload", () => {
        it("drops the stored resume URL and restarts once with a fresh POST on PATCH 404", async () => {
            expect.assertions(6);

            const urlStorage = new MemoryUrlStorage();
            const removeSpy = vi.spyOn(urlStorage, "removeEntry");
            const addSpy = vi.spyOn(urlStorage, "addEntry");
            const adapter = createTusAdapter({ chunkSize: 50, endpoint: ENDPOINT, urlStorage });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/first`));
            mockFetch.mockResolvedValueOnce(patched(50));
            mockFetch.mockResolvedValueOnce(failed(404));
            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/second`));
            mockFetch.mockResolvedValueOnce(patched(50));
            mockFetch.mockResolvedValueOnce(patched(100));
            mockFetch.mockResolvedValueOnce(headOk(100));

            const result = await adapter.upload(file);

            expect(requests().map(({ method, url }) => `${method} ${url}`)).toStrictEqual([
                `POST ${ENDPOINT}`,
                `PATCH ${ENDPOINT}/first`,
                `PATCH ${ENDPOINT}/first`,
                `POST ${ENDPOINT}`,
                `PATCH ${ENDPOINT}/second`,
                `PATCH ${ENDPOINT}/second`,
                `HEAD ${ENDPOINT}/second`,
            ]);
            // The restarted upload starts from offset 0.
            expect(requests()[4]?.headers["Upload-Offset"]).toBe("0");
            expect(result.id).toBe("second");
            expect(addSpy.mock.calls.map(([entry]) => entry.uploadUrl)).toStrictEqual([`${ENDPOINT}/first`, `${ENDPOINT}/second`]);
            // Once for the dead URL, once on success.
            expect(removeSpy).toHaveBeenCalledTimes(2);
            await expect(urlStorage.listEntries()).resolves.toHaveLength(0);
        });

        it("fails fast without retrying when the re-created upload is gone as well", async () => {
            expect.assertions(2);

            const adapter = createTusAdapter({ chunkSize: 50, endpoint: ENDPOINT, maxRetries: 5 });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/first`));
            mockFetch.mockResolvedValueOnce(failed(410));
            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/second`));
            mockFetch.mockResolvedValueOnce(failed(410));

            await expect(adapter.upload(file)).rejects.toThrow("Upload expired or not found");
            expect(mockFetch).toHaveBeenCalledTimes(4);
        });

        it("restarts when the offset re-sync HEAD after a failed non-final chunk reports 404", async () => {
            expect.assertions(1);

            const adapter = createTusAdapter({ chunkSize: 50, endpoint: ENDPOINT });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/first`));
            mockFetch.mockResolvedValueOnce(failed(500));
            mockFetch.mockResolvedValueOnce(failed(404));
            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/second`));
            mockFetch.mockResolvedValueOnce(patched(50));
            mockFetch.mockResolvedValueOnce(patched(100));
            mockFetch.mockResolvedValueOnce(headOk(100));

            await adapter.upload(file);

            expect(requests().map(({ method, url }) => `${method} ${url}`)).toStrictEqual([
                `POST ${ENDPOINT}`,
                `PATCH ${ENDPOINT}/first`,
                `HEAD ${ENDPOINT}/first`,
                `POST ${ENDPOINT}`,
                `PATCH ${ENDPOINT}/second`,
                `PATCH ${ENDPOINT}/second`,
                `HEAD ${ENDPOINT}/second`,
            ]);
        });
    });

    describe("lost response to the completing chunk", () => {
        it.each([
            ["a network error", 404, (): Promise<never> => Promise.reject(new TypeError("network down"))],
            ["a 502", 410, (): Promise<Partial<Response>> => Promise.resolve(failed(502))],
        ])("treats a gone upload after %s on the final PATCH as completed instead of re-uploading", async (_label, goneStatus, finalPatch) => {
            expect.assertions(5);

            const urlStorage = new MemoryUrlStorage();
            const progress: number[] = [];
            const adapter = createTusAdapter({ chunkSize: 50, endpoint: ENDPOINT, urlStorage });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            adapter.setOnProgress((percent) => {
                progress.push(percent);
            });

            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/abc`));
            mockFetch.mockResolvedValueOnce(patched(50));
            mockFetch.mockImplementationOnce(finalPatch);
            // The storage-backed server already dropped the finished upload.
            mockFetch.mockResolvedValueOnce(failed(goneStatus));

            const result = await adapter.upload(file);

            // No re-creation, no second upload of the file, no final HEAD against the dropped upload.
            expect(requests().map(({ method, url }) => `${method} ${url}`)).toStrictEqual([
                `POST ${ENDPOINT}`,
                `PATCH ${ENDPOINT}/abc`,
                `PATCH ${ENDPOINT}/abc`,
                `HEAD ${ENDPOINT}/abc`,
            ]);
            expect(result).toMatchObject({ id: "abc", offset: 100, size: 100, status: "completed", url: `${ENDPOINT}/abc` });
            expect(progress).toStrictEqual([50, 100]);
            expect(adapter.getOffset()).toBe(0);
            await expect(urlStorage.listEntries()).resolves.toHaveLength(0);
        });

        it("still restarts when the final PATCH itself is answered with 404", async () => {
            expect.assertions(1);

            const adapter = createTusAdapter({ chunkSize: 100, endpoint: ENDPOINT });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/first`));
            mockFetch.mockResolvedValueOnce(failed(404));
            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/second`));
            mockFetch.mockResolvedValueOnce(patched(100));
            mockFetch.mockResolvedValueOnce(headOk(100));

            await adapter.upload(file);

            expect(requests().map(({ method }) => method)).toStrictEqual(["POST", "PATCH", "POST", "PATCH", "HEAD"]);
        });

        it("resumes normally when the re-sync HEAD shows the final chunk did not land", async () => {
            expect.assertions(2);

            const adapter = createTusAdapter({ chunkSize: 100, endpoint: ENDPOINT });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/abc`));
            mockFetch.mockRejectedValueOnce(new TypeError("network down"));
            mockFetch.mockResolvedValueOnce(headOk(0));
            mockFetch.mockResolvedValueOnce(patched(100));
            mockFetch.mockResolvedValueOnce(headOk(100));

            const result = await adapter.upload(file);

            expect(requests().map(({ method }) => method)).toStrictEqual(["POST", "PATCH", "HEAD", "PATCH", "HEAD"]);
            expect(result.offset).toBe(100);
        });
    });

    it("sends 5 MiB chunks by default so S3-backed servers accept non-final chunks", async () => {
        expect.assertions(2);

        const adapter = createTusAdapter({ endpoint: ENDPOINT });
        const chunk = 5 * 1024 * 1024;
        const file = new File([new Uint8Array(chunk + 10)], "test.bin", { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/abc`));
        mockFetch.mockResolvedValueOnce(patched(chunk));
        mockFetch.mockResolvedValueOnce(patched(chunk + 10));
        mockFetch.mockResolvedValueOnce(headOk(chunk + 10));

        await adapter.upload(file);

        const patches = requests().filter(({ method }) => method === "PATCH");

        expect(patches.map(({ headers }) => headers["Content-Length"])).toStrictEqual([String(chunk), "10"]);
        expect(patches.map(({ headers }) => headers["Upload-Offset"])).toStrictEqual(["0", String(chunk)]);
    });

    it("retries a 423 Locked PATCH after re-HEADing the offset", async () => {
        expect.assertions(2);

        const adapter = createTusAdapter({ chunkSize: 100, endpoint: ENDPOINT });
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

        mockFetch.mockResolvedValueOnce(created(`${ENDPOINT}/abc`));
        mockFetch.mockResolvedValueOnce(failed(423));
        mockFetch.mockResolvedValueOnce(headOk(0));
        mockFetch.mockResolvedValueOnce(patched(100));
        mockFetch.mockResolvedValueOnce(headOk(100));

        const result = await adapter.upload(file);

        expect(result.offset).toBe(100);
        expect(requests().map(({ method }) => method)).toStrictEqual(["POST", "PATCH", "HEAD", "PATCH", "HEAD"]);
    });

    it("re-probes a stored resume URL that answers 423 Locked instead of failing", async () => {
        expect.assertions(2);

        const urlStorage = new MemoryUrlStorage();
        const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

        await urlStorage.addEntry({
            createdAt: Date.now(),
            endpoint: ENDPOINT,
            fingerprint: defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "tus" }),
            lastModified: file.lastModified,
            protocol: "tus",
            size: file.size,
            uploadUrl: `${ENDPOINT}/abc`,
        });

        const adapter = createTusAdapter({ chunkSize: 100, endpoint: ENDPOINT, urlStorage });

        mockFetch.mockResolvedValueOnce(failed(423));
        mockFetch.mockResolvedValueOnce(headOk(50));
        mockFetch.mockResolvedValueOnce(patched(100));
        mockFetch.mockResolvedValueOnce(headOk(100));

        await adapter.upload(file);

        expect(requests().map(({ method }) => method)).toStrictEqual(["HEAD", "HEAD", "PATCH", "HEAD"]);
        expect(requests()[2]?.headers["Upload-Offset"]).toBe("50");
    });

    describe("terminateOnAbort", () => {
        const routeWithHangingPatch = (deleteResponse: () => Promise<Partial<Response>>) => {
            mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
                switch (init?.method) {
                    case "DELETE": {
                        return deleteResponse();
                    }
                    case "PATCH": {
                        return hangingUntilAborted(init);
                    }
                    case "POST": {
                        return Promise.resolve(created("/api/upload/tus/abc"));
                    }
                    default: {
                        return Promise.resolve(headOk(0));
                    }
                }
            });
        };

        it("sends DELETE with Tus-Resumable through onBeforeRequest and clears the resume entry", async () => {
            expect.assertions(5);

            const urlStorage = new MemoryUrlStorage();
            const removeSpy = vi.spyOn(urlStorage, "removeEntry");
            const adapter = createTusAdapter({
                endpoint: ENDPOINT,
                onBeforeRequest: () => {
                    return { Authorization: "Bearer token" };
                },
                terminateOnAbort: true,
                urlStorage,
            });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            routeWithHangingPatch(async () => {
                return { headers: new Headers(), ok: true, status: 204 };
            });

            const uploadPromise = adapter.upload(file);

            await waitFor(() => requests().some(({ method }) => method === "PATCH"));
            adapter.abort();

            await expect(uploadPromise).rejects.toThrow("Upload aborted");

            await waitFor(() => requests().some(({ method }) => method === "DELETE"));

            const deleteRequest = requests().find(({ method }) => method === "DELETE");

            // Relative Location resolved against the endpoint.
            expect(deleteRequest?.url).toBe(`${ENDPOINT}/abc`);
            expect(deleteRequest?.headers["Tus-Resumable"]).toBe("1.0.0");
            expect(deleteRequest?.headers.Authorization).toBe("Bearer token");

            await waitFor(() => removeSpy.mock.calls.length > 0);

            await expect(urlStorage.findEntry(defaultFingerprint({ endpoint: ENDPOINT, file, protocol: "tus" }))).resolves.toBeUndefined();
        });

        it("swallows DELETE failures so abort never throws", async () => {
            expect.assertions(2);

            const adapter = createTusAdapter({ endpoint: ENDPOINT, terminateOnAbort: true });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            routeWithHangingPatch(() => Promise.reject(new TypeError("network down")));

            const uploadPromise = adapter.upload(file);

            await waitFor(() => requests().some(({ method }) => method === "PATCH"));

            expect(() => {
                adapter.abort();
            }).not.toThrow();

            await expect(uploadPromise).rejects.toThrow("Upload aborted");

            await waitFor(() => requests().some(({ method }) => method === "DELETE"));
        });

        it("terminates via control.abort() as well", async () => {
            expect.assertions(2);

            const control = new UploadControl();
            const adapter = createTusAdapter({ control, endpoint: ENDPOINT, terminateOnAbort: true });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            routeWithHangingPatch(async () => {
                return { headers: new Headers(), ok: true, status: 204 };
            });

            const uploadPromise = adapter.upload(file);

            await waitFor(() => requests().some(({ method }) => method === "PATCH"));
            control.abort();

            await expect(uploadPromise).rejects.toThrow("Upload aborted");

            await waitFor(() => requests().some(({ method }) => method === "DELETE"));

            expect(requests().filter(({ method }) => method === "DELETE")).toHaveLength(1);
        });

        it("terminates and never persists an upload created while abort was pending", async () => {
            expect.assertions(4);

            const urlStorage = new MemoryUrlStorage();
            const addSpy = vi.spyOn(urlStorage, "addEntry");
            const adapter = createTusAdapter({ endpoint: ENDPOINT, terminateOnAbort: true, urlStorage });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });
            let resolvePost: ((response: Partial<Response>) => void) | undefined;

            mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
                if (init?.method === "POST") {
                    return new Promise<Partial<Response>>((resolve) => {
                        resolvePost = resolve;
                    });
                }

                return Promise.resolve({ headers: new Headers(), ok: true, status: 204 });
            });

            const uploadPromise = adapter.upload(file);

            await waitFor(() => resolvePost !== undefined);
            adapter.abort();
            resolvePost?.(created(`${ENDPOINT}/abc`));

            await expect(uploadPromise).rejects.toThrow("Upload aborted");

            await waitFor(() => requests().some(({ method }) => method === "DELETE"));

            expect(requests().map(({ method }) => method)).toStrictEqual(["POST", "DELETE"]);
            expect(requests()[1]?.url).toBe(`${ENDPOINT}/abc`);
            expect(addSpy).not.toHaveBeenCalled();
        });

        it("does not send DELETE by default", async () => {
            expect.assertions(2);

            const adapter = createTusAdapter({ endpoint: ENDPOINT });
            const file = new File(["x".repeat(100)], "test.bin", { type: "application/octet-stream" });

            routeWithHangingPatch(async () => {
                return { headers: new Headers(), ok: true, status: 204 };
            });

            const uploadPromise = adapter.upload(file);

            await waitFor(() => requests().some(({ method }) => method === "PATCH"));
            adapter.abort();

            await expect(uploadPromise).rejects.toThrow("Upload aborted");
            expect(requests().some(({ method }) => method === "DELETE")).toBe(false);
        });
    });
});
