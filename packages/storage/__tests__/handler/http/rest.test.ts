import { rm } from "node:fs/promises";

import supertest from "supertest";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Rest from "../../../src/handler/rest";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { storageOptions, testfile } from "../../__helpers__/config";
import app from "../../__helpers__/express-app";
import { waitForStorageReady } from "../../__helpers__/utils";

describe("http Rest", () => {
    let response: supertest.Response;

    const basePath = "/http-rest";
    let directory: string;
    let rest: Rest;

    const create = (): supertest.Test => supertest(app).post(basePath).set("Content-Type", testfile.contentType).send(testfile.asBuffer);

    beforeAll(async () => {
        directory = temporaryDirectory();
        const options = { ...storageOptions, directory };
        const storage = new DiskStorage({ ...options, allowMIME: ["video/mp4", "image/*", "application/octet-stream"] });

        await waitForStorageReady(storage);

        rest = new Rest({ storage });

        app.use(basePath, rest.handle);
    });

    afterAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    describe("default options", () => {
        it("should create Rest handler instance", () => {
            expect.assertions(1);

            expect(new Rest({ storage: new DiskStorage({ directory: "/files" }) })).toBeInstanceOf(Rest);
        });
    });

    describe("post", () => {
        it("should upload file with raw binary data", async () => {
            expect.assertions(4);

            response = await create();

            expect(response.status).toBe(201);
            expect(response.body.size).toBeDefined();
            expect(response.header.location).toBeDefined();
            expect(response.body.contentType).toBe(testfile.contentType);
        });

        it("should upload file with Content-Disposition header", async () => {
            expect.assertions(3);

            response = await supertest(app)
                .post(basePath)
                .set("Content-Type", testfile.contentType)
                .set("Content-Disposition", `attachment; filename="${testfile.name}"`)
                .set("Content-Length", String(testfile.size))
                .send(testfile.asBuffer);

            expect(response.status).toBe(201);
            expect(response.body.originalName).toBe(testfile.name);
            expect(response.header.location).toBeDefined();
        });

        it("should upload file with metadata header", async () => {
            expect.assertions(3);

            const metadata = { category: "test", description: "Test file" };

            response = await supertest(app)
                .post(basePath)
                .set("Content-Type", testfile.contentType)
                .set("Content-Length", String(testfile.size))
                .set("X-File-Metadata", JSON.stringify(metadata))
                .send(testfile.asBuffer);

            expect(response.status).toBe(201);
            expect(response.body.metadata).toMatchObject(metadata);
            expect(response.header.location).toBeDefined();
        });

        it("should return 400 when no body is provided", async () => {
            expect.assertions(2);

            response = await supertest(app).post(basePath);

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        it("should return 400 when Content-Length is 0", async () => {
            expect.assertions(2);

            response = await supertest(app).post(basePath).set("Content-Type", testfile.contentType).set("Content-Length", "0").send("");

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        it("should return 413 when file exceeds max upload size", async () => {
            expect.assertions(2);

            const largeSize = 10_000_000_000; // 10GB

            response = await supertest(app)
                .post(basePath)
                .set("Content-Type", testfile.contentType)
                .set("Content-Length", String(largeSize))
                .send(testfile.asBuffer);

            expect(response.status).toBe(413);
            expect(response.body.error).toBeDefined();
        });
    });

    describe("put", () => {
        it("should create file with PUT when ID doesn't exist", async () => {
            expect.assertions(3);

            // Use a valid UUID-like ID format (two dashes)
            const fileId = "123-456-789";

            response = await supertest(app)
                .put(`${basePath}/${fileId}`)
                .set("Content-Type", testfile.contentType)
                .set("Content-Length", String(testfile.size))
                .send(testfile.asBuffer);

            // When file doesn't exist, PUT creates a new file with storage-generated ID
            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            expect(response.header.location).toBeDefined();
        });

        it("should update file with PUT when ID exists", async () => {
            expect.assertions(2);

            // First create a file
            const createResponse = await create();
            const fileId = createResponse.body.id;

            // Then update it with PUT
            const updatedContent = Buffer.from("updated content");

            response = await supertest(app)
                .put(`${basePath}/${fileId}`)
                .set("Content-Type", "text/plain")
                .set("Content-Length", String(updatedContent.length))
                .send(updatedContent);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(fileId);
        });

        it("should return 400 when no body is provided", async () => {
            expect.assertions(2);

            // Use a valid UUID-like ID format
            const fileId = "123-456-789";

            response = await supertest(app).put(`${basePath}/${fileId}`);

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });
    });

    describe("options", () => {
        it("should return 204 for OPTIONS request", async () => {
            expect.assertions(2);

            response = await supertest(app).options(basePath);

            expect(response.status).toBe(204);
            expect(response.header["x-max-upload-size"]).toBeDefined();
        });
    });

    describe("head", () => {
        it("should return file metadata", async () => {
            expect.assertions(5);

            // Create a file first
            const uploadResponse = await create();
            const fileId = uploadResponse.body.id;

            response = await supertest(app).head(`${basePath}/${fileId}`);

            expect(response.status).toBe(200);
            expect(response.header["content-length"]).toBeDefined();
            expect(response.header["content-type"]).toBeDefined();
            expect(response.header["content-length"]).toBe(String(testfile.size));
            expect(response.body).toStrictEqual({});
        });

        it("should return 404 for non-existent file", async () => {
            expect.assertions(1);

            response = await supertest(app).head(`${basePath}/non-existent-id`);

            expect(response.status).toBe(404);
        });
    });

    describe("get", () => {
        it("should return file metadata", async () => {
            expect.assertions(4);

            // Create a file first
            const uploadResponse = await create();
            const fileId = uploadResponse.body.id;
            const metadataUri = `${basePath}/${fileId}/metadata`;

            response = await supertest(app).get(metadataUri);

            expect(response.status).toBe(200);
            expect(response.header["content-type"]).toBe("application/json; charset=utf8");
            expect(response.body).toHaveProperty("id");
            expect(response.body.id).toBe(fileId);
        });

        it("should return 404 for non-existent file metadata", async () => {
            expect.assertions(1);

            const metadataUri = `${basePath}/999-999-999/metadata`;

            response = await supertest(app).get(metadataUri);

            expect(response.status).toBe(404);
        });
    });

    describe("delete", () => {
        it("should successfully delete uploaded file", async () => {
            expect.assertions(1);

            const test = await create();
            const fileId = test.body.id;

            response = await supertest(app).delete(`${basePath}/${fileId}`);

            expect(response.status).toBe(204);
        });

        it("should return 404 for non-existent file deletion", async () => {
            expect.assertions(1);

            response = await supertest(app).delete(`${basePath}/1d2a1da2s-1d5as45d5a-4d5asd`);

            expect(response.status).toBe(404);
        });

        it("should batch delete files via query parameter", async () => {
            expect.assertions(1);

            // Create multiple files
            const file1 = await create();
            const file2 = await create();
            const file3 = await create();

            const ids = [file1.body.id, file2.body.id, file3.body.id].join(",");

            response = await supertest(app).delete(`${basePath}?ids=${ids}`);

            expect(response.status).toBe(204);
        });

        it("should batch delete files via JSON body", async () => {
            expect.assertions(1);

            // Create multiple files
            const file1 = await create();
            const file2 = await create();

            const ids = [file1.body.id, file2.body.id];

            response = await supertest(app).delete(basePath).set("Content-Type", "application/json").send({ ids });

            expect(response.status).toBe(204);
        });

        it("should return 400 when batch delete has no IDs", async () => {
            expect.assertions(2);

            response = await supertest(app).delete(basePath).set("Content-Type", "application/json").send({ ids: [] });

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        it("should handle partial batch delete success", async () => {
            expect.assertions(2);

            // Create one file
            const file1 = await create();
            const fileId = file1.body.id;

            // Try to delete existing and non-existent files
            const ids = [fileId, "non-existent-id"].join(",");

            response = await supertest(app).delete(`${basePath}?ids=${ids}`);

            // Should return 207 Multi-Status for partial success
            expect([204, 207]).toContain(response.status);
            expect(response.header["x-delete-successful"]).toBeDefined();
        });
    });
});
