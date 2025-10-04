import type { Response as NodeFetchResponse } from "node-fetch";
import fetch from "node-fetch";
import { createRequest } from "node-mocks-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock(import("node-fetch"));

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
    const metafileResponse = (): { data: GCSFile } =>
        deepClone({
            data: { ...metafile, createdAt: new Date().toISOString(), uri },
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
        it("should request api and set status and uri", async () => {
            mockAuthRequest.mockRejectedValueOnce({ code: 404, detail: "meta not found" }); // getMeta
            mockAuthRequest.mockResolvedValueOnce({ headers: { location: uri } }); //
            mockAuthRequest.mockResolvedValueOnce("_saveOk");

            const gcsFile = await storage.create(request, metafile);

            expect(gcsFile).toMatchSnapshot();
            expect(mockAuthRequest).toMatchSnapshot();
        });

        it("should handle existing", async () => {
            mockAuthRequest.mockResolvedValue(metafileResponse());
            mockFetch.mockResolvedValueOnce(new Response("", { headers: { Range: "0-5" }, status: 308 }));

            const gcsFile = await storage.create(request, metafile);

            expect(gcsFile).toMatchSnapshot();
        });

        it("should reject on api error", async () => {
            const errorObject = { code: 403, response: {} };

            mockAuthRequest.mockRejectedValue(errorObject);

            await expect(storage.create(request, metafile)).rejects.toEqual(errorObject);
        });
    });

    describe(".update()", () => {
        it("should update changed metadata keys", async () => {
            mockAuthRequest.mockResolvedValue(metafileResponse());

            // eslint-disable-next-line radar/no-duplicate-string
            const gcsFile = await storage.update(metafile, { metadata: { name: "newname.mp4" } });

            expect(gcsFile.metadata.name).toBe("newname.mp4");
            expect(gcsFile.originalName).toBe("newname.mp4");
            expect(gcsFile.metadata.mimeType).toBe("video/mp4");
        });

        it("should reject if not found", async () => {
            mockAuthRequest.mockResolvedValue({});

            await expect(storage.update(metafile, { metadata: { name: "newname.mp4" } })).rejects.toHaveProperty("UploadErrorCode", "FileNotFound");
        });
    });

    describe(".write()", () => {
        it("should request api and set status and bytesWritten", async () => {
            mockAuthRequest.mockResolvedValueOnce(metafileResponse());

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

        it("should send normalized error", async () => {
            mockAuthRequest.mockResolvedValueOnce(metafileResponse());

            // eslint-disable-next-line radar/no-duplicate-string
            mockFetch.mockResolvedValueOnce(new Response("Bad Request", { status: 400 }));

            try {
                await storage.write({ contentLength: 0, id: metafile.id });
            } catch (error) {
                // eslint-disable-next-line no-secrets/no-secrets
                expect(error).toEqual(new FetchError("Bad Request", "GCS400", { uri: "http://api.com?upload_id=123456789" }));
                expect(error).toMatchSnapshot();
            }
        });

        it("should request api and set status and bytesWritten on resume", async () => {
            mockAuthRequest.mockResolvedValueOnce(metafileResponse());

            mockFetch.mockResolvedValueOnce(new Response("", { headers: { Range: "0-5" }, status: 308 }));

            const gcsFile = await storage.write({ contentLength: 0, id: metafile.id });

            expect(mockFetch).toMatchSnapshot();
            expect(gcsFile.status).toBe("part");
            expect(gcsFile.bytesWritten).toBe(6);
        });
    });

    describe(".delete()", () => {
        it("should set status", async () => {
            mockAuthRequest.mockResolvedValue({ data: { ...metafile, uri } });

            const deleted = await storage.delete(metafile);

            expect(deleted.id).toBe(metafile.id);
            expect(deleted.status).toBe("deleted");
        });

        it("should ignore if not exist", async () => {
            mockAuthRequest.mockResolvedValue({});

            const deleted = await storage.delete(metafile);

            expect(deleted.id).toBe(metafile.id);
        });
    });

    describe(".copy()", () => {
        it("relative", async () => {
            mockAuthRequest.mockResolvedValue({ data: { done: true } });

            await storage.copy(testfile, "files/новое имя.txt");

            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledWithExactlyOnceWith({
                url: "https://storage.googleapis.com/storage/v1/b/test-bucket",
            });

            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledWithExactlyOnceWith({
                body: "",
                headers: { "Content-Type": "application/json" },
                method: "POST",
                // eslint-disable-next-line no-secrets/no-secrets
                url: "https://storage.googleapis.com/storage/v1/b/test-bucket/o/testfile.mp4/rewriteTo/b/test-bucket/o/files/%D0%BD%D0%BE%D0%B2%D0%BE%D0%B5%20%D0%B8%D0%BC%D1%8F.txt",
            });
        });

        it("absolute", async () => {
            mockAuthRequest.mockResolvedValue({ data: { done: true } });

            await storage.copy(testfile, "/new/name.txt");

            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledTimes(1);
            expect(mockAuthRequest).toHaveBeenCalledWithExactlyOnceWith({
                body: "",
                headers: { "Content-Type": "application/json" },
                method: "POST",
                url: "https://storage.googleapis.com/storage/v1/b/test-bucket/o/testfile.mp4/rewriteTo/b/new/o/name.txt",
            });
        });
    });

    describe("normalizeError", () => {
        it("client error", () => {
            const error: ClientError = {
                code: "400",
                // eslint-disable-next-line no-secrets/no-secrets
                config: { uri: "http://api.com?upload_id=123456789" },
                message: "Bad Request",
                name: "ClientError",
            };

            expect(storage.normalizeError(error)).toEqual(expect.objectContaining({ code: "GCS400", statusCode: 400 }));
        });

        it("not client error", () => {
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
    ])("getRangeEnd(%s) === %i", (string_, expected) => {
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
    ])("buildContentRange(%o) === %s", (string_, expected) => {
        expect(buildContentRange(string_ as FilePart & GCSFile)).toBe(expected);
    });
});
