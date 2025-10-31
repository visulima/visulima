import { rm } from "node:fs/promises";
import { join } from "node:path";

import supertest from "supertest";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serializeMetadata, Tus, TUS_RESUMABLE, TUS_VERSION } from "../../../src/handler/tus";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { metadata, metafile, storageOptions, testfile } from "../../__helpers__/config";
import app from "../../__helpers__/express-app";

const exposedHeaders = (response: supertest.Response): string[] =>
    response
        .get("Access-Control-Expose-Headers")
        .split(",")
        .map((s) => s.toLowerCase());

describe("http Tus", () => {
    let response: supertest.Response;

    const basePath = "/http-tus";
    let directory: string;
    let storage: DiskStorage;
    let tus: Tus;

    beforeAll(async () => {
        directory = temporaryDirectory();
        const options = { ...storageOptions, directory };

        storage = new DiskStorage(options);

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

        app.use(basePath, tus.handle.bind(tus));
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

            response = await create().expect("tus-resumable", TUS_RESUMABLE);

            const location = response.header.location as string;

            expect(location).toStrictEqual(expect.stringContaining(basePath));
            expect(exposedHeaders(response)).toStrictEqual(expect.arrayContaining(["location", "upload-expires", "tus-resumable"]));
        });
    });

    describe("patch", () => {
        it("should resume upload and return 204 with upload offset", async () => {
            expect.assertions(5);

            // Create upload resource
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            response = await supertest(app)
                .patch(uploadUrl)
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Offset", "0")
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

            response = await supertest(app)
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
        it("should return upload status and metadata for valid upload", async () => {
            expect.assertions(8);

            // Create upload resource
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            response = await supertest(app).head(uploadUrl).set("Tus-Resumable", TUS_RESUMABLE);

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

        it("should return 404 for non-existent upload", async () => {
            expect.assertions(2);

            response = await supertest(app).head(`${basePath}/89das8d9-4das5d4as8d78-4d8sad8a`).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(404);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
        });
    });

    describe("get", () => {
        it("should return file metadata", async () => {
            expect.assertions(1);

            // Create upload resource
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;
            const metadataUri = `${uploadUrl}/metadata`;

            response = await supertest(app).get(metadataUri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(200);
        });

        it("should return 404 for non-existent file metadata", async () => {
            expect.assertions(2);

            const metadataUri = `${basePath}/nonexistent/metadata`;

            response = await supertest(app).get(metadataUri).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(404);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
        });
    });

    describe("options", () => {
        it("should return 204 with Tus protocol configuration headers", async () => {
            expect.assertions(9);

            response = await supertest(app).options(basePath).set("Tus-Resumable", TUS_RESUMABLE);

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

            response = await supertest(app).delete(uploadUrl).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(204);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
        });

        it("should return 404 for non-existent upload resource", async () => {
            expect.assertions(2);

            response = await supertest(app).delete(`${basePath}/${metafile.id}`).set("Tus-Resumable", TUS_RESUMABLE);

            expect(response.status).toBe(404);
            expect(response.header["tus-resumable"]).toStrictEqual(TUS_RESUMABLE);
        });
    });

    describe("pOST (creation-with-upload)", () => {
        it("should create upload with initial data and return upload offset", async () => {
            expect.assertions(5);

            response = await supertest(app)
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
            expect(response.header.location).toStrictEqual(expect.stringContaining(basePath));
        });
    });

    describe("tus-Resumable header validation", () => {
        it("should return 412 for POST request without Tus-Resumable header", async () => {
            expect.assertions(2);

            response = await supertest(app).post(basePath).set("Upload-Length", metadata.size.toString()).set("Upload-Metadata", serializeMetadata(metadata));

            expect(response.status).toBe(412);
            expect(response.body.error).toBeDefined();
        });

        it("should return 412 for POST request with invalid Tus-Resumable version", async () => {
            expect.assertions(2);

            response = await supertest(app)
                .post(basePath)
                .set("Tus-Resumable", "0.2.2")
                .set("Upload-Length", metadata.size.toString())
                .set("Upload-Metadata", serializeMetadata(metadata));

            expect(response.status).toBe(412);
            expect(response.body.error).toBeDefined();
        });

        it("should return 412 for PATCH request without Tus-Resumable header", async () => {
            expect.assertions(2);

            // First create a valid upload
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            response = await supertest(app)
                .patch(uploadUrl)
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Offset", "0")
                .set("Content-Length", "5")
                .send(testfile.asBuffer.slice(0, 5));

            expect(response.status).toBe(412);
            expect(response.body.error).toBeDefined();
        });

        it("should return 412 for PATCH request with invalid Tus-Resumable version", async () => {
            expect.assertions(2);

            // First create a valid upload
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            response = await supertest(app)
                .patch(uploadUrl)
                .set("Tus-Resumable", "0.2.2")
                .set("Content-Type", "application/offset+octet-stream")
                .set("Upload-Offset", "0")
                .set("Content-Length", "5")
                .send(testfile.asBuffer.slice(0, 5));

            expect(response.status).toBe(412);
            expect(response.body.error).toBeDefined();
        });

        it("should return 412 for HEAD request without Tus-Resumable header", async () => {
            expect.assertions(1);

            // First create a valid upload
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            response = await supertest(app).head(uploadUrl);

            expect(response.status).toBe(412);
        });

        it("should return 412 for GET request without Tus-Resumable header", async () => {
            expect.assertions(2);

            // First create a valid upload
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            response = await supertest(app).get(uploadUrl);

            expect(response.status).toBe(412);
            expect(response.body.error).toBeDefined();
        });

        it("should return 412 for DELETE request without Tus-Resumable header", async () => {
            expect.assertions(2);

            // First create a valid upload
            const createResponse = await create();
            const uploadUrl = createResponse.header.location;

            response = await supertest(app).delete(uploadUrl);

            expect(response.status).toBe(412);
            expect(response.body.error).toBeDefined();
        });

        it("should accept OPTIONS request without Tus-Resumable header", async () => {
            expect.assertions(1);

            response = await supertest(app).options(basePath);

            expect(response.status).toBe(204);
        });
    });
});
