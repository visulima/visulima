import { rm } from "node:fs/promises";

import supertest from "supertest";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseMetadata, serializeMetadata, Tus, TUS_RESUMABLE, TUS_VERSION } from "../../../src/handler/tus";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { Metadata } from "../../../src/storage/utils/file";
import { metadata, metafile, storageOptions, testfile } from "../../__helpers__/config";
import app from "../../__helpers__/express-app";

const exposedHeaders = (response: supertest.Response): string[] =>
    response
        .get("Access-Control-Expose-Headers")
        .split(",")
        .map((s) => s.toLowerCase());

describe("express Tus", () => {
    const basePath = "/tus";
    let directory: string;
    let storage: DiskStorage;
    let tus: Tus;

    beforeAll(async () => {
        directory = temporaryDirectory();
        storage = new DiskStorage({ ...storageOptions, directory });

        // Wait for storage to be ready
        await new Promise((resolve) => {
            const checkReady = () => {
                if (storage.isReady) {
                    resolve(undefined);
                } else {
                    setTimeout(checkReady, 10);
                }
            };

            checkReady();
        });

        tus = new Tus({ storage });

        app.use(basePath, tus.handle);
    });

    const create = (): supertest.Test =>
        supertest(app)
            .post(basePath)
            .set("Upload-Metadata", serializeMetadata(metadata))
            .set("Upload-Length", metadata.size.toString())
            .set("Tus-Resumable", TUS_RESUMABLE);

    // Note: tempy handles automatic cleanup of temporary directories

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

            const response = await create().expect("tus-resumable", TUS_RESUMABLE);

            const location = response.header.location as string;

            expect(location).toStrictEqual(expect.stringContaining("/tus"));
            expect(exposedHeaders(response)).toStrictEqual(expect.arrayContaining(["location", "tus-resumable"]));
        });
    });

    describe("patch", () => {
        it("should resume upload and return 204 with upload offset", async () => {
            expect.assertions(5);

            // Create upload resource
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            // Resume upload with no data (just check status)
            const response = await supertest(app)
                .patch(uploadUrl)
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Offset", "0")
                .set("Content-Length", "0")
                .set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(204);
            expect(response.header["upload-offset"]).toBe("0");
            expect(response.header["tus-resumable"]).toBe(TUS_RESUMABLE);
            expect(response.header["upload-expires"]).toStrictEqual(expect.stringMatching(/.*\S.*/));

            expect(exposedHeaders(response)).toStrictEqual(expect.arrayContaining(["upload-offset", "upload-expires", "tus-resumable"]));
        });

        it("should complete upload with checksum and return 200", async () => {
            expect.assertions(4);

            // Create upload resource
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            // Complete the upload with data and checksum
            const response = await supertest(app)
                .patch(uploadUrl)
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
        it("should return upload status for completed upload", async () => {
            expect.assertions(8);

            // Create and complete an upload
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            // Complete the upload
            await supertest(app)
                .patch(uploadUrl)
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Offset", "0")
                .set("Tus-Resumable", TUS_RESUMABLE)
                .send(testfile.asBuffer);

            // Now check the status
            const response = await supertest(app).head(uploadUrl).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(200);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
            expect(response.header["upload-offset"]).toStrictEqual(metadata.size.toString());
            expect(response.header["upload-expires"]).toStrictEqual(expect.stringMatching(/.*\S.*/));
            expect(response.header["upload-metadata"]).toStrictEqual(expect.stringMatching(/.*\S.*/));
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

            // Create upload resource
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            // Extract ID and modify storage directly (for testing edge case)
            const id = uploadUrl.replace("/tus/", "").replace(".mp4", "");

            await tus.storage.update({ id }, { metadata: { size: Number.NaN }, size: Number.NaN });

            const response = await supertest(app).head(uploadUrl).set("Tus-Resumable", TUS_RESUMABLE);

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
            expect(response.header["access-control-allow-methods"]).toBe("DELETE, DOWNLOAD, GET, HEAD, OPTIONS, PATCH, POST");
            expect(response.header["access-control-allow-headers"]).toBe(
                "Authorization, Content-Type, Location, Tus-Extension, Tus-Max-Size, Tus-Resumable, Tus-Version, Upload-Concat, Upload-Defer-Length, Upload-Length, Upload-Metadata, Upload-Offset, X-HTTP-Method-Override, X-Requested-With",
            );
            expect(response.header["access-control-max-age"]).toBe("86400");
        });
    });

    describe("delete", () => {
        it("should successfully delete upload resource", async () => {
            expect.assertions(2);

            // Create upload resource
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            const response = await supertest(app).delete(uploadUrl).set("Tus-Resumable", TUS_RESUMABLE);

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
            expect.assertions(2);

            const sample = "";

            const result = parseMetadata(sample);

            expect(result).toBeInstanceOf(Metadata);
            expect(Object.keys(result)).toHaveLength(0);
        });

        it("should parse single key/value", () => {
            expect.assertions(2);

            const sample = "name dGl0bGUubXA0";

            const result = parseMetadata(sample);

            expect(result).toBeInstanceOf(Metadata);
            expect(result.name).toBe("title.mp4");
        });

        it("should parse empty value", () => {
            expect.assertions(2);

            const sample = "is_ok";

            const result = parseMetadata(sample);

            expect(result).toBeInstanceOf(Metadata);
            expect(result.is_ok).toBe("");
        });

        it("should parse multiple keys", () => {
            expect.assertions(6);

            // eslint-disable-next-line no-secrets/no-secrets
            const sample = "name dGl0bGUubXA0,mimeType dmlkZW8vbXA0,size ODM4NjkyNTM=,lastModified MTQzNzM5MDEzODIzMQ==,is_ok";

            const result = parseMetadata(sample);

            expect(result).toBeInstanceOf(Metadata);
            expect(result.is_ok).toBe("");
            expect(result.lastModified).toBe("1437390138231");
            expect(result.mimeType).toBe("video/mp4");
            expect(result.name).toBe("title.mp4");
            expect(result.size).toBe("83869253");
        });
    });
});
