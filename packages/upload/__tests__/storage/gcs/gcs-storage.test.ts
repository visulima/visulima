import fetch, { Response as NodeFetchResponse } from "node-fetch";
import { createRequest } from "node-mocks-http";
import type { MockedFunction } from "vitest";
import {
    afterEach, beforeEach, describe, expect, it, vi,
} from "vitest";

import FetchError from "../../../src/storage/gcs/fetch-error";
import GCSFile from "../../../src/storage/gcs/gcs-file";
import GCStorage from "../../../src/storage/gcs/gcs-storage";
import type { ClientError, GCStorageOptions } from "../../../src/storage/gcs/types.d";
import { buildContentRange, getRangeEnd } from "../../../src/storage/gcs/utils";
import type { FilePart } from "../../../src/storage/utils/file";
import { metafile, storageOptions, testfile } from "../../__helpers__/config";
import { deepClone } from "../../__helpers__/utils";

vi.mock("node-fetch");

const mockFetch = fetch as MockedFunction<typeof fetch>;

const mockAuthRequest = vi.fn();

vi.mock("google-auth-library", () => {
    return {
        GoogleAuth: vi.fn(() => {
            return { request: mockAuthRequest };
        }),
    };
});

describe("GCStorage", async () => {
    const { Response } = await vi.importActual<{ Response: typeof NodeFetchResponse }>("node-fetch");

    vi.useFakeTimers().setSystemTime(new Date("2022-02-02"));

    let storage: GCStorage;

    // eslint-disable-next-line no-secrets/no-secrets,radar/no-duplicate-string
    const uri = "http://api.com?upload_id=123456789";
    const request = createRequest({ headers: { origin: "http://api.com" } });
    const metafileResponse = (): { data: GCSFile } => deepClone({
        data: { ...metafile, uri, createdAt: new Date().toISOString() },
    });

    beforeEach(async () => {
        vi.clearAllMocks();

        mockAuthRequest.mockResolvedValueOnce({ bucket: "ok" });

        storage = new GCStorage({ ...(storageOptions as GCStorageOptions), bucket: "test-bucket" });
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
            mockFetch.mockResolvedValueOnce(new Response("", { status: 308, headers: { Range: "0-5" } }));

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

    describe(".list()", () => {
        it("should return all user files", async () => {
            const list = { data: { items: [{ name: testfile.metafilename }] } };

            mockAuthRequest.mockResolvedValue(list);

            const items = await storage.list();

            expect(items).toMatchSnapshot();
        });
    });

    describe(".write()", () => {
        it("should request api and set status and bytesWritten", async () => {
            mockAuthRequest.mockResolvedValueOnce(metafileResponse());

            mockFetch.mockResolvedValueOnce(new Response('{"mediaLink":"http://api.com/123456789"}', { status: 200 }));

            const body = testfile.asReadable;
            const gcsFile = await storage.write({
                id: metafile.id,
                body,
                start: 0,
                contentLength: metafile.size,
            });

            expect(mockFetch).toHaveBeenCalledWith(uri, {
                body,
                method: "PUT",
                headers: expect.objectContaining({ "Content-Range": "bytes 0-63/64" }),
                signal: expect.any(AbortSignal),
            });
            expect(gcsFile).toMatchSnapshot();
        });

        it("should send normalized error", async () => {
            mockAuthRequest.mockResolvedValueOnce(metafileResponse());

            // eslint-disable-next-line radar/no-duplicate-string
            mockFetch.mockResolvedValueOnce(new Response("Bad Request", { status: 400 }));

            try {
                await storage.write({ id: metafile.id, contentLength: 0 });
            } catch (error) {
                // eslint-disable-next-line no-secrets/no-secrets
                expect(error).toEqual(new FetchError("Bad Request", "GCS400", { uri: "http://api.com?upload_id=123456789" }));
                expect(error).toMatchSnapshot();
            }
        });

        it("should request api and set status and bytesWritten on resume", async () => {
            mockAuthRequest.mockResolvedValueOnce(metafileResponse());

            mockFetch.mockResolvedValueOnce(new Response("", { status: 308, headers: { Range: "0-5" } }));

            const gcsFile = await storage.write({ id: metafile.id, contentLength: 0 });

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

            await storage.copy(testfile.name, "files/новое имя.txt");

            expect(mockAuthRequest).toHaveBeenCalledWith({
                url: "https://storage.googleapis.com/storage/v1/b/test-bucket",
            });

            expect(mockAuthRequest).toHaveBeenCalledWith({
                body: "",
                headers: { "Content-Type": "application/json" },
                method: "POST",
                // eslint-disable-next-line max-len,no-secrets/no-secrets
                url: "https://storage.googleapis.com/storage/v1/b/test-bucket/o/testfile.mp4/rewriteTo/b/test-bucket/o/files/%D0%BD%D0%BE%D0%B2%D0%BE%D0%B5%20%D0%B8%D0%BC%D1%8F.txt",
            });
        });

        it("absolute", async () => {
            mockAuthRequest.mockResolvedValue({ data: { done: true } });

            await storage.copy(testfile.name, "/new/name.txt");

            expect(mockAuthRequest).toHaveBeenCalledWith({
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

describe("Range utils", () => {
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
        [{ start: 0, body }, "bytes 0-*/*"],
        [{ start: 10, size: 80, body }, "bytes 10-*/80"],
        [
            {
                start: 0,
                contentLength: 80,
                size: 80,
                body,
            },
            "bytes 0-79/80",
        ],
        [{ start: 0, contentLength: 80, size: 80 }, "bytes */80"],
    ])("buildContentRange(%o) === %s", (string_, expected) => {
        expect(buildContentRange(string_ as FilePart & GCSFile)).toBe(expected);
    });
});
