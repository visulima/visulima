import { rm } from "node:fs/promises";
import { join } from "node:path";

import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import Tus, { parseMetadata, serializeMetadata, TUS_RESUMABLE, TUS_VERSION } from "../../../src/handler/tus";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { metadata, metafile, storageOptions, testfile, testRoot } from "../../__helpers__/config";
import app from "../../__helpers__/express-app";

vi.mock(import("node:fs/promises"), () => {
    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs.promises,
    };
});

vi.mock(import("node:fs"), () => {
    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs,
    };
});

const exposedHeaders = (response: supertest.Response): string[] =>
    response
        .get("Access-Control-Expose-Headers")
        .split(",")
        .map((s) => s.toLowerCase());

describe("express Tus", () => {
    let uri = "";
    const basePath = "/tus";
    const directory = join(testRoot, "tus");
    const options = { ...storageOptions, directory };
    const tus = new Tus({ storage: new DiskStorage(options) });

    app.use(basePath, tus.handle);

    function create(): supertest.Test {
        return (
            supertest(app)
                .post(basePath)
                // eslint-disable-next-line radar/no-duplicate-string
                .set("Upload-Metadata", serializeMetadata(metadata))
                // eslint-disable-next-line radar/no-duplicate-string
                .set("Upload-Length", metadata.size.toString())
                // eslint-disable-next-line radar/no-duplicate-string
                .set("Tus-Resumable", TUS_RESUMABLE)
        );
    }

    beforeAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    afterAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    describe("default options", () => {
        it("should create Tus handler instance", () => {
            expect.assertions(1);

            expect(new Tus({ storage: new DiskStorage({ directory: "files" }) })).toBeInstanceOf(Tus);
        });
    });

    describe("post", () => {
        it("should create upload resource and return 201 with location header", async () => {
            expect.assertions(2);

            // eslint-disable-next-line radar/no-duplicate-string
            const response = await create().expect("tus-resumable", TUS_RESUMABLE);

            uri = response.header.location as string;

            expect(uri).toStrictEqual(expect.stringContaining("/tus"));
            // eslint-disable-next-line radar/no-duplicate-string
            expect(exposedHeaders(response)).toStrictEqual(expect.arrayContaining(["location", "upload-expires", "tus-resumable"]));
        });
    });

    describe("patch", () => {
        it("should resume upload and return 204 with upload offset", async () => {
            expect.assertions(5);

            const test = await create();

            uri ||= test.header.location;

            const response = await supertest(app)
                .patch(uri)
                // eslint-disable-next-line radar/no-duplicate-string
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Offset", "0")
                .set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(204);
            // eslint-disable-next-line radar/no-duplicate-string
            expect(response.header["upload-offset"]).toBe("0");
            expect(response.header["tus-resumable"]).toBe(TUS_RESUMABLE);
            expect(response.header["upload-expires"]).toStrictEqual(expect.stringMatching(/.*\S.*/));

            expect(exposedHeaders(response)).toStrictEqual(expect.arrayContaining(["upload-offset", "upload-expires", "tus-resumable"]));
        });

        it("should complete upload with checksum and return 200", async () => {
            expect.assertions(4);

            const test = await create();

            uri ||= test.header.location;

            const response = await supertest(app)
                .patch(uri)
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .set("Upload-Offset", "0")
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Checksum", `sha1 ${metadata.sha1}`)
                .send(testfile.asBuffer);

            expect(response.status).toBe(200);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
            expect(response.header["upload-expires"]).toStrictEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header["upload-offset"]).toStrictEqual(metadata.size.toString());
        });
    });

    describe("head", () => {
        // eslint-disable-next-line radar/no-duplicate-string
        it("should 204", async () => {
            expect.assertions(8);

            const test = await create();

            uri ||= test.header.location;

            const response = await supertest(app).head(uri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(200);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
            expect(response.header["upload-offset"]).toStrictEqual(metadata.size.toString());
            // eslint-disable-next-line radar/no-duplicate-string
            expect(response.header["upload-expires"]).toStrictEqual(expect.stringMatching(/.*\S.*/));
            // eslint-disable-next-line radar/no-duplicate-string
            expect(response.header["upload-metadata"]).toStrictEqual(expect.stringMatching(/.*\S.*/));
            // eslint-disable-next-line radar/no-duplicate-string
            expect(response.header["upload-length"]).toStrictEqual(expect.stringMatching(/\d*/));
            expect(response.header["cache-control"]).toBe("no-store");

            expect(exposedHeaders(response)).toStrictEqual(
                expect.arrayContaining(["upload-offset", "upload-length", "upload-metadata", "upload-expires", "tus-resumable"]),
            );
        });

        it("should 404", async () => {
            expect.assertions(2);

            const response = await supertest(app).head(`${basePath}/89das8d9-4das5d4as8d78-4d8sad8a`).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(404);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
        });

        it("should resolve with upload-defer-length", async () => {
            expect.assertions(8);

            const test = await create();

            uri ||= test.header.location;

            const id = uri.replace("/tus/", "").replace(".mp4", "");

            tus.storage.update({ id }, { metadata: { size: Number.NaN }, size: Number.NaN });

            const response = await supertest(app).head(uri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(200);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
            expect(response.header["upload-offset"]).toBe("64");
            expect(response.header["upload-expires"]).toStrictEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header["upload-metadata"]).toStrictEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header["upload-length"]).toBeUndefined();
            expect(response.header["cache-control"]).toBe("no-store");
            expect(response.header["upload-defer-length"]).toBe("1");
        });
    });

    describe("options", () => {
        it("should 204", async () => {
            expect.assertions(9);

            const response = await supertest(app).options(basePath).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(204);
            expect(response.header["tus-version"]).toStrictEqual(TUS_VERSION);
            expect(response.header["tus-extension"]).toBe("creation,creation-with-upload,termination,checksum,creation-defer-length,expiration");
            expect(response.header["tus-max-size"]).toBe("6442450944");
            expect(response.header["tus-checksum-algorithm"]).toBe("md5,sha1");
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
            expect(response.header["access-control-allow-methods"]).toBe("DELETE, GET, HEAD, OPTIONS, PATCH, POST");
            expect(response.header["access-control-allow-headers"]).toBe(
                "Authorization, Content-Type, Location, Tus-Extension, Tus-Max-Size, Tus-Resumable, Tus-Version, Upload-Concat, Upload-Defer-Length, Upload-Length, Upload-Metadata, Upload-Offset, X-HTTP-Method-Override, X-Requested-With",
            );
            expect(response.header["access-control-max-age"]).toBe("86400");
        });
    });

    describe("delete", () => {
        it("should 204", async () => {
            expect.assertions(2);

            const test = await create();

            uri ||= test.header.location;

            const response = await supertest(app).delete(uri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(204);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
        });

        it("should 404", async () => {
            expect.assertions(2);

            const response = await supertest(app).delete(`${basePath}/${metafile.id}`).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(404);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
        });
    });

    describe("post (creation-with-upload)", () => {
        it("should return upload-offset", async () => {
            expect.assertions(5);

            const response = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .set("Upload-Length", metadata.size.toString())
                .set("Tus-Resumable", TUS_RESUMABLE)
                .send(testfile.asBuffer.slice(0, 5));

            expect(response.status).toBe(200);
            expect(response.header["upload-offset"]).toBe("5");
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
            expect(response.header["upload-expires"]).toStrictEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header.location).toStrictEqual(expect.stringContaining("/tus"));
        });
    });

    describe("metadata parser", () => {
        it("should return empty object", () => {
            expect.assertions(1);

            const sample = "";

            expect(parseMetadata(sample)).toStrictEqual({});
        });

        it("should parse single key/value", () => {
            expect.assertions(1);

            const sample = "name dGl0bGUubXA0";

            expect(parseMetadata(sample)).toStrictEqual({ name: "title.mp4" });
        });

        it("should parse empty value", () => {
            expect.assertions(1);

            const sample = "is_ok";

            expect(parseMetadata(sample)).toStrictEqual({ is_ok: "" });
        });

        it("should parse multiple keys", () => {
            expect.assertions(1);

            // eslint-disable-next-line no-secrets/no-secrets
            const sample = "name dGl0bGUubXA0,mimeType dmlkZW8vbXA0,size ODM4NjkyNTM=,lastModified MTQzNzM5MDEzODIzMQ==,is_ok";

            expect(parseMetadata(sample)).toStrictEqual({
                is_ok: "",
                lastModified: "1437390138231",
                mimeType: "video/mp4",
                name: "title.mp4",
                size: "83869253",
            });
        });
    });
});
