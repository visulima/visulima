import type { Response as NodeFetchResponse } from "node-fetch";
import fetch from "node-fetch";
import { createRequest } from "node-mocks-http";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import FetchError from "../../../src/storage/gcs/fetch-error";
import type GCSFile from "../../../src/storage/gcs/gcs-file";
import GCStorage from "../../../src/storage/gcs/gcs-storage";
import type { ClientError, GCStorageOptions } from "../../../src/storage/gcs/types";
import { buildContentRange, getRangeEnd } from "../../../src/storage/gcs/utils";
import type { FilePart } from "../../../src/storage/utils/file";
import { metafile, storageOptions, testfile } from "../../__helpers__/config";
import { deepClone } from "../../__helpers__/utils";

const { mockFetch } = vi.hoisted(() => {
    return {
        mockFetch: vi.fn(),
    };
});

vi.mock(import("node-fetch"), () => {
    return {
        default: mockFetch,
    };
});

const mockAuthRequest = vi.fn();

vi.mock(import("google-auth-library"), () => {
    return {
        GoogleAuth: vi.fn(() => {
            return { request: mockAuthRequest };
        }),
    };
});

describe(GCStorage, async () => {
    const { Response } = await vi.importActual<{ Response: typeof NodeFetchResponse }>("node-fetch");

    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    let storage: GCStorage;

    // eslint-disable-next-line no-secrets/no-secrets,radar/no-duplicate-string
    const uri = "http://api.com?upload_id=123456789";
    const request = createRequest({ headers: { origin: "http://api.com" } });
    const metafileResponse = (): { data: GCSFile; status: number } =>
        deepClone({
            data: { ...metafile, createdAt: new Date().toISOString(), uri },
            status: 200,
        });

    beforeEach(async () => {
        vi.clearAllMocks();

        mockAuthRequest.mockResolvedValueOnce({ bucket: "ok" });

        storage = new GCStorage({ ...(storageOptions as GCStorageOptions), bucket: "test-bucket", projectId: "test" });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe(".create()", () => {
        it("should make API request and set file status and URI", async () => {
            expect.assertions(2);

            mockAuthRequest.mockRejectedValueOnce({ code: 404, detail: "meta not found" }); // getMeta
            mockAuthRequest.mockResolvedValueOnce({
                headers: { get: (name: string) => (name === "location" ? uri : name === "X-Goog-Upload-Status" ? "active" : undefined) },
                status: 200,
            }); // create
            mockAuthRequest.mockResolvedValueOnce("_saveOk"); // saveMeta

            const gcsFile = await storage.create(request, metafile);

            expect(gcsFile).toMatchSnapshot();
            expect(mockAuthRequest).toMatchSnapshot();
        });

        it("should handle existing files correctly", async () => {
            expect.assertions(1);

            mockAuthRequest.mockResolvedValue(metafileResponse());
            mockFetch.mockResolvedValueOnce(new Response("", { headers: { Range: "0-5" }, status: 308 }));

            const gcsFile = await storage.create(request, metafile);

            expect(gcsFile).toMatchSnapshot();
        });

        it("should reject when API returns an error", async () => {
            expect.assertions(1);

            const errorObject = { code: 403, response: {} };

            mockAuthRequest.mockRejectedValue(errorObject);

            await expect(storage.create(request, metafile)).rejects.toEqual(errorObject);
        });

        it("should handle TTL option and set expiration timestamp", async () => {
            mockAuthRequest.mockRejectedValueOnce({ code: 404, detail: "meta not found" }); // getMeta
            mockAuthRequest.mockResolvedValueOnce({
                headers: { get: (name: string) => (name === "location" ? uri : name === "X-Goog-Upload-Status" ? "active" : undefined) },
                status: 200,
            }); // create
            mockAuthRequest.mockResolvedValueOnce("_saveOk"); // saveMeta

            const gcsFile = await storage.create(request, { ...metafile, ttl: "7d" });

            expect(gcsFile.expiredAt).toBeDefined();

            expectTypeOf(gcsFile.expiredAt).toBeNumber();

            // TTL should be converted to expiredAt timestamp
            const expectedExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days in ms

            expect(gcsFile.expiredAt).toBeGreaterThan(expectedExpiry - 1000); // Allow 1s tolerance
            expect(gcsFile.expiredAt).toBeLessThan(expectedExpiry + 1000);
        });
    });

    describe(".update()", () => {
        it("should update changed metadata keys correctly", async () => {
            expect.assertions(3);

            mockAuthRequest.mockResolvedValue(metafileResponse());

            // eslint-disable-next-line radar/no-duplicate-string
            const gcsFile = await storage.update(metafile, { metadata: { name: "newname.mp4" } });

            expect(gcsFile.metadata.name).toBe("newname.mp4");
            expect(gcsFile.originalName).toBe("newname.mp4");
            expect(gcsFile.metadata.mimeType).toBe("video/mp4");
        });

        it("should reject update operation when file is not found", async () => {
            expect.assertions(1);

            mockAuthRequest.mockResolvedValue({});

            await expect(storage.update(metafile, { metadata: { name: "newname.mp4" } })).rejects.toHaveProperty("UploadErrorCode", "FileNotFound");
        });

        it("should handle TTL option and set expiration timestamp during update", async () => {
            mockAuthRequest.mockResolvedValue(metafileResponse());

            const gcsFile = await storage.update(metafile, { ttl: "2h" });

            expect(gcsFile.expiredAt).toBeDefined();

            expectTypeOf(gcsFile.expiredAt).toBeNumber();

            // TTL should be converted to expiredAt timestamp
            const expectedExpiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours in ms

            expect(gcsFile.expiredAt).toBeGreaterThan(expectedExpiry - 1000); // Allow 1s tolerance
            expect(gcsFile.expiredAt).toBeLessThan(expectedExpiry + 1000);
        });
    });

    describe(".write()", () => {
        it("should make API request and set file status and bytesWritten", async () => {
            expect.assertions(3);

            vi.spyOn(storage, "getMeta").mockResolvedValue(metafile);

            mockAuthRequest.mockResolvedValueOnce({ data: { mediaLink: uri }, status: 200 });

            mockFetch.mockResolvedValueOnce(new Response("{\"mediaLink\":\"http://api.com/123456789\"}", { status: 200 }));

            const body = testfile.asReadable;
            const gcsFile = await storage.write({
                body,
                contentLength: metafile.size,
                id: metafile.id,
                start: 0,
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWithExactlyOnceWith(uri, {
                body,
                headers: expect.objectContaining({ "Content-Range": "bytes 0-63/64" }),
                method: "PUT",
                signal: expect.any(AbortSignal),
            });
            expect(gcsFile).toMatchSnapshot();
        });

        it("should send normalized error for API failures", async () => {
            expect.assertions(2);

            mockAuthRequest.mockResolvedValueOnce(metafileResponse());

            // Mock the makeRequest to return error response
            mockAuthRequest.mockResolvedValueOnce({ data: "Bad Request", status: 400 });

            try {
                await storage.write({ contentLength: 0, id: metafile.id });
            } catch (error) {
                // eslint-disable-next-line no-secrets/no-secrets
                expect(error).toEqual(new FetchError("Bad Request", "GCS400", { uri: "http://api.com?upload_id=123456789" }));
                expect(error).toMatchSnapshot();
            }
        });

        it("should make API request and set status and bytesWritten when resuming", async () => {
            expect.assertions(3);

            vi.spyOn(storage, "getMeta").mockResolvedValue({ ...metafile, bytesWritten: 0 });

            mockAuthRequest.mockResolvedValueOnce({ data: { mediaLink: uri }, status: 200 });

            mockFetch.mockResolvedValueOnce(new Response("", { headers: { Range: "0-5" }, status: 200 }));

            const gcsFile = await storage.write({ contentLength: 0, id: metafile.id });

            expect(mockFetch).toMatchSnapshot();
            expect(gcsFile.status).toBe("part");
            expect(gcsFile.bytesWritten).toBe(6);
        });
    });

    describe(".delete()", () => {
        it("should mark file as deleted and return file data", async () => {
            expect.assertions(2);

            mockAuthRequest.mockResolvedValue({ data: { ...metafile, uri } });

            const deleted = await storage.delete(metafile);

            expect(deleted.id).toBe(metafile.id);
            expect(deleted.status).toBe("deleted");
        });

        it("should handle deletion of non-existent files gracefully", async () => {
            expect.assertions(1);

            mockAuthRequest.mockResolvedValue({});

            const deleted = await storage.delete(metafile);

            expect(deleted.id).toBe(metafile.id);
        });
    });

    describe(".copy()", () => {
        it("should copy file to relative path with correct API calls", async () => {
            expect.assertions(5);

            mockAuthRequest.mockClear();
            mockAuthRequest.mockResolvedValue({ data: { done: true } });

            await storage.copy(metafile, "files/новое имя.txt");

            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledWith({
                url: "https://storage.googleapis.com/storage/v1/b/test-bucket",
            });

            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledWith({
                body: "",
                headers: { "Content-Type": "application/json" },
                method: "POST",
                // eslint-disable-next-line no-secrets/no-secrets
                url: "https://storage.googleapis.com/storage/v1/b/test-bucket/o/testfile.mp4/rewriteTo/b/test-bucket/o/files/%D0%BD%D0%BE%D0%B2%D0%BE%D0%B5%20%D0%B8%D0%BC%D1%8F.txt",
            });
        });

        it("should copy file to absolute path with correct API calls", async () => {
            expect.assertions(3);

            mockAuthRequest.mockClear();
            mockAuthRequest.mockResolvedValue({ data: { done: true } });

            await storage.copy(metafile, "/new/name.txt");

            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledWith({
                body: "",
                headers: { "Content-Type": "application/json" },
                method: "POST",
                url: "https://storage.googleapis.com/storage/v1/b/test-bucket/o/testfile.mp4/rewriteTo/b/new/o/name.txt",
            });
        });

        it("should copy file with storage class option", async () => {
            expect.assertions(3);

            mockAuthRequest.mockClear();
            mockAuthRequest.mockResolvedValue({ data: { done: true } });

            await storage.copy(metafile, "files/backup.txt", { storageClass: "COLDLINE" });

            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledWith({
                body: "",
                headers: { "Content-Type": "application/json" },
                method: "POST",
                url: "https://storage.googleapis.com/storage/v1/b/test-bucket/o/testfile.mp4/rewriteTo/b/test-bucket/o/files/backup.txt",
            });
        });
    });

    describe("normalizeError", () => {
        it("should normalize client error with correct code and status", () => {
            expect.assertions(1);

            const error: ClientError = {
                code: "400",
                // eslint-disable-next-line no-secrets/no-secrets
                config: { uri: "http://api.com?upload_id=123456789" },
                message: "Bad Request",
                name: "ClientError",
            };

            expect(storage.normalizeError(error)).toEqual(expect.objectContaining({ code: "GCS400", statusCode: 400 }));
        });

        it("should normalize non-client errors with generic error code", () => {
            expect.assertions(1);

            expect(storage.normalizeError(new Error("unknown") as ClientError)).toEqual(expect.objectContaining({ code: "GenericUploadError" }));
        });
    });
});

describe("range utils", () => {
    it.each([
        ["", 0],
        ["0-0", 0],
        ["0-1", 2],
        ["0-10000", 10_001],
    ])("should calculate correct range end for input: %s -> %i", (string_, expected) => {
        expect.assertions(1);

        expect(getRangeEnd(string_)).toBe(expected);
    });

    const body = true;

    it.each([
        [{}, "bytes */*"],
        [{ body }, "bytes */*"],
        [{ start: 0 }, "bytes */*"],
        [{ body, start: 0 }, "bytes 0-*/*"],
        [{ body, size: 80, start: 10 }, "bytes 10-*/80"],
        [
            {
                body,
                contentLength: 80,
                size: 80,
                start: 0,
            },
            "bytes 0-79/80",
        ],
        [{ contentLength: 80, size: 80, start: 0 }, "bytes */80"],
    ])("should build correct content range header for input: %o -> %s", (string_, expected) => {
        expect.assertions(1);

        expect(buildContentRange(string_ as FilePart & GCSFile)).toBe(expected);
    });
});
