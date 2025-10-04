import { rm } from "node:fs/promises";
import { join } from "node:path";

import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import Tus, { parseMetadata, serializeMetadata, TUS_RESUMABLE, TUS_VERSION } from "../../../src/handler/tus";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { metadata, metafile, storageOptions, testfile, testRoot } from "../../__helpers__/config";
import app from "../../__helpers__/express-app";

vi.mock(import("node:fs/promises"), () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs.promises,
    };
});

vi.mock(import("node:fs"), () => {
    const process = require("node:process");

    process.chdir("/");

    const { fs } = require("memfs");

    return {
        __esModule: true,
        ...fs,
    };
});

// eslint-disable-next-line radar/no-identical-functions
vi.mock(import("node:fs"), () => {
    const process = require("node:process");

    process.chdir("/");

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
        it("should be defined", () => {
            expect(new Tus({ storage: new DiskStorage({ directory: "files" }) })).toBeInstanceOf(Tus);
        });
    });

    describe("pOST", () => {
        it("should 201", async () => {
            // eslint-disable-next-line radar/no-duplicate-string
            const response = await create().expect("tus-resumable", TUS_RESUMABLE);

            uri = response.header.location as string;

            expect(uri).toEqual(expect.stringContaining("/tus"));
            // eslint-disable-next-line radar/no-duplicate-string
            expect(exposedHeaders(response)).toEqual(expect.arrayContaining(["location", "upload-expires", "tus-resumable"]));
        });
    });

    describe("pATCH", () => {
        it("should 204 and Upload-Offset", async () => {
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
            expect(response.header["upload-expires"]).toEqual(expect.stringMatching(/.*\S.*/));

            expect(exposedHeaders(response)).toEqual(expect.arrayContaining(["upload-offset", "upload-expires", "tus-resumable"]));
        });

        it("should 200", async () => {
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
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
            expect(response.header["upload-expires"]).toEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header["upload-offset"]).toEqual(metadata.size.toString());
        });
    });

    describe("hEAD", () => {
        // eslint-disable-next-line radar/no-duplicate-string
        it("should 204", async () => {
            const test = await create();

            uri ||= test.header.location;

            const response = await supertest(app).head(uri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(200);
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
            expect(response.header["upload-offset"]).toEqual(metadata.size.toString());
            // eslint-disable-next-line radar/no-duplicate-string
            expect(response.header["upload-expires"]).toEqual(expect.stringMatching(/.*\S.*/));
            // eslint-disable-next-line radar/no-duplicate-string
            expect(response.header["upload-metadata"]).toEqual(expect.stringMatching(/.*\S.*/));
            // eslint-disable-next-line radar/no-duplicate-string
            expect(response.header["upload-length"]).toEqual(expect.stringMatching(/\d*/));
            expect(response.header["cache-control"]).toBe("no-store");

            expect(exposedHeaders(response)).toEqual(
                expect.arrayContaining(["upload-offset", "upload-length", "upload-metadata", "upload-expires", "tus-resumable"]),
            );
        });

        it("should 404", async () => {
            const response = await supertest(app).head(`${basePath}/89das8d9-4das5d4as8d78-4d8sad8a`).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(404);
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
        });

        it("should resolve with upload-defer-length", async () => {
            const test = await create();

            uri ||= test.header.location;

            const id = uri.replace("/tus/", "").replace(".mp4", "");

            tus.storage.update({ id }, { metadata: { size: Number.NaN }, size: Number.NaN });

            const response = await supertest(app).head(uri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(200);
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
            expect(response.header["upload-offset"]).toBe("64");
            expect(response.header["upload-expires"]).toEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header["upload-metadata"]).toEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header["upload-length"]).toBeUndefined();
            expect(response.header["cache-control"]).toBe("no-store");
            expect(response.header["upload-defer-length"]).toBe("1");
        });
    });

    describe("oPTIONS", () => {
        it("should 204", async () => {
            const response = await supertest(app).options(basePath).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(204);
            expect(response.header["tus-version"]).toEqual(TUS_VERSION);
            expect(response.header["tus-extension"]).toBe("creation,creation-with-upload,termination,checksum,creation-defer-length,expiration");
            expect(response.header["tus-max-size"]).toBe("6442450944");
            expect(response.header["tus-checksum-algorithm"]).toBe("md5,sha1");
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
            expect(response.header["access-control-allow-methods"]).toBe("DELETE, GET, HEAD, OPTIONS, PATCH, POST");
            expect(response.header["access-control-allow-headers"]).toBe(
                "Authorization, Content-Type, Location, Tus-Extension, Tus-Max-Size, Tus-Resumable, Tus-Version, Upload-Concat, Upload-Defer-Length, Upload-Length, Upload-Metadata, Upload-Offset, X-HTTP-Method-Override, X-Requested-With",
            );
            expect(response.header["access-control-max-age"]).toBe("86400");
        });
    });

    describe("dELETE", () => {
        it("should 204", async () => {
            const test = await create();

            uri ||= test.header.location;

            const response = await supertest(app).delete(uri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(204);
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
        });

        it("should 404", async () => {
            const response = await supertest(app).delete(`${basePath}/${metafile.id}`).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(404);
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
        });
    });

    describe("pOST (creation-with-upload)", () => {
        it("should return upload-offset", async () => {
            const response = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .set("Upload-Length", metadata.size.toString())
                .set("Tus-Resumable", TUS_RESUMABLE)
                .send(testfile.asBuffer.slice(0, 5));

            expect(response.status).toBe(200);
            expect(response.header["upload-offset"]).toBe("5");
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
            expect(response.header["upload-expires"]).toEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header.location).toEqual(expect.stringContaining("/tus"));
        });
    });

    describe("metadata parser", () => {
        it("should return empty object", () => {
            const sample = "";

            expect(parseMetadata(sample)).toEqual({});
        });

        it("should parse single key/value", () => {
            const sample = "name dGl0bGUubXA0";

            expect(parseMetadata(sample)).toEqual({ name: "title.mp4" });
        });

        it("should parse empty value", () => {
            const sample = "is_ok";

            expect(parseMetadata(sample)).toEqual({ is_ok: "" });
        });

        it("should parse multiple keys", () => {
            // eslint-disable-next-line no-secrets/no-secrets
            const sample = "name dGl0bGUubXA0,mimeType dmlkZW8vbXA0,size ODM4NjkyNTM=,lastModified MTQzNzM5MDEzODIzMQ==,is_ok";

            expect(parseMetadata(sample)).toEqual({
                is_ok: "",
                lastModified: "1437390138231",
                mimeType: "video/mp4",
                name: "title.mp4",
                size: "83869253",
            });
        });
    });
});
