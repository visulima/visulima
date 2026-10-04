import { rm } from "node:fs/promises";

import express from "express";
import supertest from "supertest";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Rest from "../../../../src/handler/rest/rest";
import DiskStorage from "../../../../src/storage/local/disk-storage";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import { storageOptions, testfile } from "../../../__helpers__/config";
import app from "../../../__helpers__/express-app";
import { waitForStorageReady } from "../../../__helpers__/utils";

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
        it("should answer an absolute Location unless useRelativeLocation is set", async () => {
            expect.assertions(1);

            const absoluteApp = express();
            const absoluteRest = new Rest({ storage: new MemoryStorage({ allowMIME: ["video/*"] }) });

            absoluteApp.use(basePath, absoluteRest.handle);

            const absolute = await supertest(absoluteApp).post(basePath).set("Content-Type", testfile.contentType).send(testfile.asBuffer);

            expect(absolute.header.location).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/http-rest\//u);
        });

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
        it("should create the file under the id from the URL with a Location of the form <collection>/<id>.<ext>", async () => {
            expect.assertions(3);

            response = await supertest(app)
                .put(`${basePath}/node-location-id`)
                .set("Content-Type", testfile.contentType)
                .set("Content-Length", String(testfile.size))
                .send(testfile.asBuffer);

            expect(response.status).toBe(201);
            expect(response.body.id).toBe("node-location-id");
            expect(response.header.location).toMatch(new RegExp(String.raw`${basePath}/node-location-id\.\w+$`, "u"));
        });

        it("should create, read and delete a short caller-chosen id like the fetch handler", async () => {
            expect.assertions(3);

            const put = await supertest(app)
                .put(`${basePath}/abc`)
                .set("Content-Type", testfile.contentType)
                .set("Content-Length", String(testfile.size))
                .send(testfile.asBuffer);

            expect(put.status).toBe(201);

            const head = await supertest(app).head(`${basePath}/abc`);

            expect(head.status).toBe(200);

            const deleted = await supertest(app).delete(`${basePath}/abc`);

            expect(deleted.status).toBe(204);
        });

        it("should refuse to overwrite another file's metadata sidecar", async () => {
            expect.assertions(3);

            const victim = await create();

            response = await supertest(app)
                .put(`${basePath}/${victim.body.id}.META.x`)
                .set("Content-Type", "application/json")
                .set("Content-Length", "21")
                .send('{"owner":"attacker"}\n');

            expect(response.status).toBe(400);

            const metadata = await supertest(app).get(`${basePath}/${victim.body.id}/metadata`);

            expect(metadata.status).toBe(200);
            expect(metadata.body.id).toBe(victim.body.id);
        });

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

        it("should replace the file with PUT when ID exists", async () => {
            expect.assertions(3);

            // First create a file
            const createResponse = await create();
            const fileId = createResponse.body.id;

            // Then replace it with PUT
            const updatedContent = Buffer.from("updated content");

            response = await supertest(app)
                .put(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(updatedContent.length))
                .send(updatedContent);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(fileId);

            const download = await supertest(app).get(`${basePath}/${fileId}`).buffer(true);

            expect(Buffer.from(download.body as Buffer).toString()).toBe("updated content");
        });

        it("should validate the replacement like a new upload, keeping the original when refused", async () => {
            expect.assertions(2);

            const createResponse = await create();

            response = await supertest(app)
                .put(`${basePath}/${createResponse.body.id}`)
                .set("Content-Type", "text/plain")
                .set("Content-Length", "4")
                .send(Buffer.from("text"));

            expect(response.status).toBe(415);

            const original = await supertest(app).get(`${basePath}/${createResponse.body.id}`);

            expect(original.status).toBe(200);
        });

        it("should answer 409 for a PUT over a file stored without upload metadata", async () => {
            expect.assertions(2);

            const { writeFile } = await import("node:fs/promises");
            const { join } = await import("node:path");

            await writeFile(join(directory, "untracked-file"), "the real file");

            response = await supertest(app)
                .put(`${basePath}/untracked-file`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", "4")
                .send(Buffer.from("evil"));

            expect(response.status).toBe(409);

            const { readFile } = await import("node:fs/promises");

            await expect(readFile(join(directory, "untracked-file"), "utf8")).resolves.toBe("the real file");
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

        it("should download a file by id", async () => {
            expect.assertions(2);

            const created = await create();

            response = await supertest(app).get(`${basePath}/${created.body.id}`);

            expect(response.status).toBe(200);
            expect(Buffer.from(response.body as Buffer)).toHaveLength(testfile.size);
        });

        it("should download a file with a caller-chosen non-UUID id", async () => {
            expect.assertions(3);

            const put = await supertest(app)
                .put(`${basePath}/node-custom-id`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", "5")
                .send(Buffer.from("hello"));

            expect(put.status).toBe(201);

            response = await supertest(app)
                .get(`${basePath}/node-custom-id`)
                .buffer(true)
                .parse((incoming, callback) => {
                    const chunks: Buffer[] = [];

                    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
                    incoming.on("end", () => callback(null, Buffer.concat(chunks)));
                });

            expect(response.status).toBe(200);
            expect((response.body as Buffer).toString()).toBe("hello");
        });

        it.each(["..%2F..%2Fetc%2Fpasswd", "%2Fetc%2Fpasswd"])("should reject the encoded traversal id %s with 400", async (id) => {
            expect.assertions(1);

            response = await supertest(app).get(`${basePath}/${id}`);

            expect(response.status).toBe(400);
        });

        it.each(["", "/V1StGXR8_Z5jdHi6B-myT"])("should answer 404 instead of listing files for GET %s by default", async (suffix) => {
            expect.assertions(2);

            await create();

            response = await supertest(app).get(`${basePath}${suffix}`);

            expect(response.status).toBe(404);
            expect(JSON.stringify(response.body)).not.toContain("createdAt");
        });

        it("should list files for the collection path when listing is enabled", async () => {
            expect.assertions(2);

            const listingApp = express();

            listingApp.use(basePath, new Rest({ allowList: true, storage: rest.storage }).handle);

            await create();

            response = await supertest(listingApp).get(basePath);

            expect(response.status).toBe(200);
            expect(response.body.length).toBeGreaterThan(0);
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

        it("should deliver a 413 for an oversized batch-delete body and keep the URL file", async () => {
            expect.assertions(2);

            const created = await create();

            response = await supertest(app)
                .delete(`${basePath}/${created.body.id}`)
                .set("Content-Type", "application/json")
                .send(JSON.stringify(["x".repeat(1_100_000)]));

            expect(response.status).toBe(413);

            const head = await supertest(app).head(`${basePath}/${created.body.id}`);

            expect(head.status).toBe(200);
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
