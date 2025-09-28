import { rm } from "node:fs/promises";
import {
    afterAll, beforeAll, describe, expect, it,
} from "vitest";
import { join } from "node:path";
import supertest from "supertest";

import Tus, {
    parseMetadata, serializeMetadata, TUS_RESUMABLE, TUS_VERSION,
} from "../../../src/handler/tus";
import DiskStorage from "../../../src/storage/local/disk-storage";
import {
    metadata, metafile, storageOptions, testfile, testRoot,
} from "../../__helpers__/config";
import app from "../../__helpers__/express-app";

jest.mock("fs/promises", () => {
    // eslint-disable-next-line unicorn/prefer-module
    const process = require("node:process");
    process.chdir("/");

    // eslint-disable-next-line unicorn/prefer-module
    const { fs } = require("memfs");

    return fs.promises;
});

jest.mock("fs", () => {
    // eslint-disable-next-line unicorn/prefer-module
    const process = require("node:process");
    process.chdir("/");

    // eslint-disable-next-line unicorn/prefer-module
    const { fs } = require("memfs");

    return fs;
});

const exposedHeaders = (response: supertest.Response): string[] => response
    .get("Access-Control-Expose-Headers")
    .split(",")
    .map((s) => s.toLowerCase());

describe("HTTP Tus", () => {
    let response: supertest.Response;
    let uri = "";

    const basePath = "/http-tus";
    const directory = join(testRoot, "http-tus");
    const options = { ...storageOptions, directory };
    const tus = new Tus({ storage: new DiskStorage(options) });

    app.use(basePath, async (req, res) => {
        const handler = await import("../../../src/http/tus");
        const httpTusHandler = handler.default;

        const tusHandler = httpTusHandler({ storage: new DiskStorage(options) });
        await tusHandler(req, res);
    });

    function create(): supertest.Test {
        return (
            supertest(app)
                .post(basePath)
                .set("Upload-Metadata", serializeMetadata(metadata))
                .set("Upload-Length", metadata.size.toString())
                .set("Tus-Resumable", TUS_RESUMABLE)
        );
    }

    beforeAll(async () => {
        try {
            await rm(directory, { recursive: true, force: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    afterAll(async () => {
        try {
            await rm(directory, { recursive: true, force: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    describe("default options", () => {
        it("should be defined", () => {
            expect(new Tus({ storage: new DiskStorage({ directory: "files" }) })).toBeInstanceOf(Tus);
        });
    });

    describe("POST", () => {
        it("should 201", async () => {
            response = await create().expect("tus-resumable", TUS_RESUMABLE);

            uri = response.header.location as string;

            expect(uri).toEqual(expect.stringContaining(basePath));
            expect(exposedHeaders(response)).toEqual(expect.arrayContaining(["location", "upload-expires", "tus-resumable"]));
        });
    });

    describe("PATCH", () => {
        it("should 204 and Upload-Offset", async () => {
            const test = await create();

            uri ||= test.header.location;

            response = await supertest(app)
                .patch(uri)
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Offset", "0")
                .set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(204);
            expect(response.header["upload-offset"]).toBe("0");
            expect(response.header["tus-resumable"]).toBe(TUS_RESUMABLE);
            expect(response.header["upload-expires"]).toEqual(expect.stringMatching(/.*\S.*/));

            expect(exposedHeaders(response)).toEqual(expect.arrayContaining(["upload-offset", "upload-expires", "tus-resumable"]));
        });

        it("should 200", async () => {
            const test = await create();

            uri ||= test.header.location;

            response = await supertest(app)
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

    describe("HEAD", () => {
        it("should 200", async () => {
            const test = await create();

            uri ||= test.header.location;

            response = await supertest(app).head(uri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(200);
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
            expect(response.header["upload-offset"]).toEqual(metadata.size.toString());
            expect(response.header["upload-expires"]).toEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header["upload-metadata"]).toEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header["upload-length"]).toEqual(expect.stringMatching(/\d*/));
            expect(response.header["cache-control"]).toBe("no-store");

            expect(exposedHeaders(response)).toEqual(
                expect.arrayContaining(["upload-offset", "upload-length", "upload-metadata", "upload-expires", "tus-resumable"]),
            );
        });

        it("should 404", async () => {
            response = await supertest(app).head(`${basePath}/89das8d9-4das5d4as8d78-4d8sad8a`).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(404);
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
        });
    });

    describe("OPTIONS", () => {
        it("should 204", async () => {
            response = await supertest(app).options(basePath).set("Tus-Resumable", TUS_RESUMABLE);

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

    describe("DELETE", () => {
        it("should 204", async () => {
            const test = await create();

            uri ||= test.header.location;

            response = await supertest(app).delete(uri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(204);
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
        });

        it("should 404", async () => {
            response = await supertest(app).delete(`${basePath}/${metafile.id}`).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(404);
            expect(response.header["tus-resumable"]).toEqual(TUS_RESUMABLE);
        });
    });

    describe("POST (creation-with-upload)", () => {
        it("should return upload-offset", async () => {
            response = await supertest(app)
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
            expect(response.header.location).toEqual(expect.stringContaining(basePath));
        });
    });
});
