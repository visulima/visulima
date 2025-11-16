import { rm } from "node:fs/promises";

import supertest from "supertest";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import Rest from "../../../src/handler/rest";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { storageOptions, testfile } from "../../__helpers__/config";
import app from "../../__helpers__/express-app";
import { waitForStorageReady } from "../../__helpers__/utils";

describe("http Rest - Chunked Uploads", () => {
    let response: supertest.Response;

    const basePath = "/http-rest-chunked";
    let directory: string;
    let rest: Rest;

    // Test file: 100 bytes split into 3 chunks (40, 40, 20)
    const testFileSize = 100;
    const chunkSize = 40;
    const testFileBuffer = Buffer.from("x".repeat(testFileSize));
    const chunk1 = testFileBuffer.slice(0, 40);
    const chunk2 = testFileBuffer.slice(40, 80);
    const chunk3 = testFileBuffer.slice(80, 100);

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

    describe("pOST - Initialize chunked upload", () => {
        it("should create chunked upload session", async () => {
            response = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", "0")
                .set("X-Chunked-Upload", "true")
                .set("X-Total-Size", String(testFileSize))
                .set("Content-Disposition", "attachment; filename=\"test.bin\"")
                .send("");

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();

            expectTypeOf(response.body.id).toBeString();

            expect(response.header["x-upload-id"]).toBeDefined();
            expect(response.header["x-chunked-upload"]).toBe("true");
            expect(response.header.location).toBeDefined();
        });

        it("should create chunked upload with metadata", async () => {
            const metadata = { category: "test", description: "Chunked upload test" };

            response = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", "0")
                .set("X-Chunked-Upload", "true")
                .set("X-Total-Size", String(testFileSize))
                .set("X-File-Metadata", JSON.stringify(metadata))
                .send("");

            expect(response.status).toBe(201);
            expect(response.body.metadata).toMatchObject(metadata);
            // Metadata values are serialized as strings, so check for string "true" or boolean true
            expect([true, "true"]).toContain(response.body.metadata._chunkedUpload);
        });

        it("should return 413 when total size exceeds max upload size", async () => {
            const largeSize = 10_000_000_000; // 10GB

            response = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", "0")
                .set("X-Chunked-Upload", "true")
                .set("X-Total-Size", String(largeSize))
                .send("");

            expect(response.status).toBe(413);
            expect(response.body.error).toBeDefined();

            expectTypeOf(response.body.error).toBeObject();
        });
    });

    describe("pATCH - Upload chunks", () => {
        let fileId: string;

        beforeEach(async () => {
            // Initialize chunked upload
            const initResponse = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", "0")
                .set("X-Chunked-Upload", "true")
                .set("X-Total-Size", String(testFileSize))
                .send("");

            expect(initResponse.status).toBe(201);

            // Extract fileId from response body (preferred) or Location header
            fileId = initResponse.body.id;

            // If not in body, extract from Location header (remove file extension)
            if (!fileId && initResponse.header.location) {
                const locationParts = initResponse.header.location.split("/");
                const lastPart = locationParts[locationParts.length - 1];

                fileId = lastPart.replace(/\.[^/.]+$/, "");
            }

            expect(fileId).toBeDefined();

            expectTypeOf(fileId).toBeString();

            expect(fileId.length).toBeGreaterThanOrEqual(8); // getIdFromRequest requires at least 8 chars

            // Verify file exists by making a HEAD request
            const verifyResponse = await supertest(app).head(`${basePath}/${fileId}`);

            expect(verifyResponse.status).toBe(200);
        });

        it("should upload first chunk", async () => {
            // Verify file exists before uploading chunk
            const headResponse = await supertest(app).head(`${basePath}/${fileId}`);

            expect(headResponse.status).toBe(200);

            response = await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            expect(response.status).toBe(202); // 202 Accepted for partial upload
            expect(response.header["x-upload-offset"]).toBeDefined();
            expect(response.header["x-upload-complete"]).toBe("false");
            expect(Number.parseInt(response.header["x-upload-offset"], 10)).toBeGreaterThanOrEqual(chunk1.length);
        });

        it("should upload chunks in order", async () => {
            // Upload chunk 1
            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            // Upload chunk 2
            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk2.length))
                .set("X-Chunk-Offset", "40")
                .send(chunk2);

            // Upload chunk 3
            response = await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk3.length))
                .set("X-Chunk-Offset", "80")
                .send(chunk3);

            expect(response.status).toBe(200); // 200 OK when complete
            expect(response.header["x-upload-complete"]).toBe("true");
            expect(Number.parseInt(response.header["x-upload-offset"], 10)).toBe(testFileSize);
        });

        it("should handle out-of-order chunks", async () => {
            // Upload chunk 3 first (out of order)
            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk3.length))
                .set("X-Chunk-Offset", "80")
                .send(chunk3);

            // Upload chunk 1
            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            // Upload chunk 2
            response = await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk2.length))
                .set("X-Chunk-Offset", "40")
                .send(chunk2);

            expect(response.status).toBe(200); // Should complete successfully
            expect(response.header["x-upload-complete"]).toBe("true");
            expect(response.header["x-upload-offset"]).toBeDefined();
            expect(Number.parseInt(response.header["x-upload-offset"], 10)).toBe(testFileSize);
        });

        it("should handle duplicate chunks (idempotency)", async () => {
            // Upload chunk 1
            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            // Upload chunk 1 again (should be idempotent)
            response = await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            expect(response.status).toBe(202);
            expect(response.header["x-upload-complete"]).toBe("false");
        });

        it("should return 400 when X-Chunk-Offset header is missing", async () => {
            response = await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .send(chunk1);

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();

            expectTypeOf(response.body.error).toBeObject();
        });

        it("should return 400 when chunk exceeds file size", async () => {
            response = await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", String(testFileSize + 10)) // Offset beyond file size
                .send(chunk1);

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();

            expectTypeOf(response.body.error).toBeObject();
        });

        it("should return 400 when chunk size exceeds max chunk size", async () => {
            const largeChunk = Buffer.alloc(101 * 1024 * 1024); // 101MB (exceeds 100MB limit)

            response = await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(largeChunk.length))
                .set("X-Chunk-Offset", "0")
                .send(largeChunk);

            expect(response.status).toBe(413);
            expect(response.body.error).toBeDefined();

            expectTypeOf(response.body.error).toBeObject();
        });

        it("should return 404 when upload session doesn't exist", async () => {
            response = await supertest(app)
                .patch(`${basePath}/non-existent-id`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            expect(response.status).toBe(404);
            expect(response.body.error).toBeDefined();

            expectTypeOf(response.body.error).toBeObject();
        });

        it("should return 400 when file is not a chunked upload", async () => {
            // Create a regular (non-chunked) upload
            const regularUpload = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(testFileSize))
                .send(testFileBuffer);

            const regularFileId = regularUpload.body.id;

            // Try to upload chunk to regular upload
            response = await supertest(app)
                .patch(`${basePath}/${regularFileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();

            expectTypeOf(response.body.error).toBeObject();
            expectTypeOf(response.body.error.message).toBeString();

            expect(response.body.error.message).toContain("not a chunked upload");
        });

        it("should return 200 when upload is already completed", async () => {
            // Complete the upload
            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk2.length))
                .set("X-Chunk-Offset", "40")
                .send(chunk2);

            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk3.length))
                .set("X-Chunk-Offset", "80")
                .send(chunk3);

            // Try to upload chunk again after completion
            response = await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            expect(response.status).toBe(200);
            expect(response.header["x-upload-complete"]).toBe("true");
        });
    });

    describe("hEAD - Get upload status", () => {
        let fileId: string;

        beforeEach(async () => {
            // Initialize chunked upload
            const initResponse = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", "0")
                .set("X-Chunked-Upload", "true")
                .set("X-Total-Size", String(testFileSize))
                .send("");

            fileId = initResponse.body.id;

            expectTypeOf(fileId).toBeString();
        });

        it("should return chunked upload status headers", async () => {
            response = await supertest(app).head(`${basePath}/${fileId}`);

            expect(response.status).toBe(200);
            expect(response.header["x-chunked-upload"]).toBe("true");
            expect(response.header["x-upload-offset"]).toBeDefined();
            expect(response.header["x-upload-complete"]).toBe("false");
            expect(response.header["content-length"]).toBe(String(testFileSize));
        });

        it("should return received chunks info", async () => {
            // Upload a chunk
            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            response = await supertest(app).head(`${basePath}/${fileId}`);

            expect(response.status).toBe(200);
            expect(response.header["x-received-chunks"]).toBeDefined();

            // Parse chunks info
            const chunksInfo = JSON.parse(response.header["x-received-chunks"]);

            expect(Array.isArray(chunksInfo)).toBe(true);

            expectTypeOf(chunksInfo).toBeObject();

            expect(chunksInfo.length).toBeGreaterThan(0);
        });

        it("should return complete status when upload is finished", async () => {
            // Complete the upload
            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk2.length))
                .set("X-Chunk-Offset", "40")
                .send(chunk2);

            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk3.length))
                .set("X-Chunk-Offset", "80")
                .send(chunk3);

            response = await supertest(app).head(`${basePath}/${fileId}`);

            expect(response.status).toBe(200);
            expect(response.header["x-upload-complete"]).toBe("true");
        });

        it("should not return chunked headers for regular uploads", async () => {
            // Create a regular (non-chunked) upload
            const regularUpload = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(testFileSize))
                .send(testFileBuffer);

            const regularFileId = regularUpload.body.id;

            response = await supertest(app).head(`${basePath}/${regularFileId}`);

            expect(response.status).toBe(200);
            expect(response.header["x-chunked-upload"]).toBeUndefined();
        });
    });

    describe("complete chunked upload flow", () => {
        it("should complete full chunked upload workflow", async () => {
            // 1. Initialize chunked upload
            const initResponse = await supertest(app)
                .post(basePath)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", "0")
                .set("X-Chunked-Upload", "true")
                .set("X-Total-Size", String(testFileSize))
                .set("Content-Disposition", "attachment; filename=\"test.bin\"")
                .send("");

            expect(initResponse.status).toBe(201);

            const fileId = initResponse.body.id;

            expectTypeOf(fileId).toBeString();

            // 2. Check initial status
            let statusResponse = await supertest(app).head(`${basePath}/${fileId}`);

            expect(statusResponse.header["x-upload-offset"]).toBe("0");
            expect(statusResponse.header["x-upload-complete"]).toBe("false");

            // 3. Upload chunks (out of order to test ordering)
            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk2.length))
                .set("X-Chunk-Offset", "40")
                .send(chunk2);

            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk1.length))
                .set("X-Chunk-Offset", "0")
                .send(chunk1);

            await supertest(app)
                .patch(`${basePath}/${fileId}`)
                .set("Content-Type", "application/octet-stream")
                .set("Content-Length", String(chunk3.length))
                .set("X-Chunk-Offset", "80")
                .send(chunk3);

            // 4. Verify completion
            statusResponse = await supertest(app).head(`${basePath}/${fileId}`);

            expect(statusResponse.header["x-upload-complete"]).toBe("true");
            expect(Number.parseInt(statusResponse.header["x-upload-offset"], 10)).toBe(testFileSize);

            // 5. Verify file can be retrieved
            const getResponse = await supertest(app).get(`${basePath}/${fileId}/metadata`);

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.size).toBe(testFileSize);
        });
    });
});
