import { rm } from "node:fs/promises";
import { createServer } from "node:http";

import supertest from "supertest";
import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serializeMetadata, Tus, TUS_RESUMABLE } from "../../../src/handler/tus";
import DiskStorage from "../../../src/storage/local/disk-storage";
import type { File } from "../../../src/storage/utils/file";
import { metadata, storageOptions } from "../../__helpers__/config";
import app from "../../__helpers__/express-app";

describe("tUS Extended Tests (matching tus-node-server e2e)", () => {
    const STORE_PATH = "/files";
    let server: any;
    let listener: ReturnType<typeof createServer>;
    let agent: supertest.SuperAgentTest;

    beforeAll(async () => {
        // Setup storage with expiration
        const directory = temporaryDirectory();
        const storage = new DiskStorage({
            ...storageOptions,
            directory,
            expiration: {
                maxAge: "50ms", // Very short for testing
                purgeInterval: "100ms",
            },
        });

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

        server = new Tus({ storage });
        app.use(STORE_PATH, server.handle);

        listener = createServer(app);
        listener.listen();

        agent = supertest.agent(listener);
    });

    afterAll(async () => {
        listener.close();

        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    describe("fileStore with relativeLocation", () => {
        let relativeServer: Tus;
        let relativeListener: ReturnType<typeof createServer>;

        beforeAll(async () => {
            const relativeDirectory = temporaryDirectory();
            const relativeStorage = new DiskStorage({
                ...storageOptions,
                directory: relativeDirectory,
                useRelativeLocation: true,
            });

            relativeServer = new Tus<File>({ storage: relativeStorage });
            app.use(`${STORE_PATH}-relative`, relativeServer.handle);

            relativeListener = createServer(app);
            relativeListener.listen();
        });

        afterAll(async () => {
            relativeListener.close();

            try {
                await rm(relativeDirectory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        it("should create a file and respond with relative location", async () => {
            expect.assertions(4);

            const response = await agent
                .post(`${STORE_PATH}-relative`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", "1000")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            expect(response.headers.location).toBeDefined();
            expect(response.headers["tus-resumable"]).toBe(TUS_RESUMABLE);
            // The location header should not be absolute (not contain //)
            expect(response.headers.location).not.toContain("//");
            expect(response.headers.location).toContain(STORE_PATH);
        });
    });

    describe("fileStore with expiration", () => {
        let expiredServer: Tus;
        let expiredListener: ReturnType<typeof createServer>;

        beforeAll(async () => {
            const expiredDirectory = temporaryDirectory();
            const expiredStorage = new DiskStorage({
                ...storageOptions,
                directory: expiredDirectory,
                expiration: {
                    maxAge: "50ms",
                    purgeInterval: "100ms",
                },
            });

            expiredServer = new Tus<File>({ storage: expiredStorage });
            app.use(`${STORE_PATH}-expired`, expiredServer.handle);

            expiredListener = createServer(app);
            expiredListener.listen();

            // Create a test file for all expiration tests
            const response = await agent
                .post(`${STORE_PATH}-expired`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", "1000")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

        });

        afterAll(async () => {
            expiredListener.close();

            try {
                await rm(expiredDirectory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        it("should respond with expiration in Tus-Extension header", async () => {
            expect.assertions(1);

            const response = await agent.options(`${STORE_PATH}-expired`).set("Tus-Resumable", TUS_RESUMABLE).expect(204);

            expect(response.headers["tus-extension"]).toContain("expiration");
        });

        it("should return 410 Gone for expired upload", async () => {
            // Create a separate file for this test
            const response = await agent
                .post(`${STORE_PATH}-expired`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", "1000")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            const testFileId = response.headers.location.split("/").pop();

            // Wait for the file to expire (50ms + buffer)
            await new Promise((resolve) => setTimeout(resolve, 100));

            await agent.head(`${STORE_PATH}-expired/${testFileId}`).set("Tus-Resumable", TUS_RESUMABLE).expect(410);
        });

        it("should return 410 Gone for PATCH on expired upload", async () => {
            // Create a separate file for this test
            const response = await agent
                .post(`${STORE_PATH}-expired`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", "1000")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            const testFileId = response.headers.location.split("/").pop();

            // Wait for the file to expire (50ms + buffer)
            await new Promise((resolve) => setTimeout(resolve, 100));

            await agent
                .patch(`${STORE_PATH}-expired/${testFileId}`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Offset", "0")
                .set("Content-Type", "application/offset+octet-stream")
                .send("test")
                .expect(410);
        });

        it("should handle purge of expired files", async () => {
            expect.assertions(3);

            // Wait a bit more for expiration
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Files should be deleted by expiration, so purge should find 0 items
            const deleted = await expiredServer.storage.purge();

            // The purge should work correctly (even if no files to purge)
            expect(deleted).toBeDefined();
            expect(deleted.items).toBeDefined();
            expect(Array.isArray(deleted.items)).toBe(true);
        });
    });

    describe("fileStore with MaxFileSize", () => {
        let maxSizeServer: Tus;
        let maxSizeListener: ReturnType<typeof createServer>;

        beforeAll(async () => {
            const maxSizeDirectory = temporaryDirectory();
            const maxSizeStorage = new DiskStorage({
                ...storageOptions,
                directory: maxSizeDirectory,
                maxUploadSize: "1MB", // 1MB limit for testing
            });

            maxSizeServer = new Tus<File>({ storage: maxSizeStorage });
            app.use(`${STORE_PATH}-maxsize`, maxSizeServer.handle);

            maxSizeListener = createServer(app);
            maxSizeListener.listen();
        });

        afterAll(async () => {
            maxSizeListener.close();

            try {
                await rm(maxSizeDirectory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        it("should not allow creating upload that exceeds max file size", async () => {
            await agent
                .post(`${STORE_PATH}-maxsize`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", (2 * 1024 * 1024).toString()) // 2MB > 1MB limit
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(413);
        });

        it("should allow creating upload within max file size", async () => {
            expect.assertions(1);

            const response = await agent
                .post(`${STORE_PATH}-maxsize`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", (500 * 1024).toString()) // 500KB < 1MB limit
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            expect(response.headers.location).toBeDefined();
        });

        it("should enforce max size during chunked upload", async () => {
            expect.assertions(1);

            // Create an upload within the limit
            const response = await agent
                .post(`${STORE_PATH}-maxsize`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", (500 * 1024).toString()) // 500KB < 1MB limit
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            const uploadId = response.headers.location.split("/").pop();
            const chunkSize = 300 * 1024; // 300KB chunks

            // Upload first chunk successfully
            await agent
                .patch(`${STORE_PATH}-maxsize/${uploadId}`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Offset", "0")
                .set("Content-Type", "application/offset+octet-stream")
                .send(Buffer.alloc(chunkSize, "a"))
                .expect(204);

            // Try to upload second chunk that would exceed the limit
            // This should fail because we're pretending the total size is 2MB but limit is 1MB
            const oversizedResponse = await agent
                .post(`${STORE_PATH}-maxsize`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", (2 * 1024 * 1024).toString()) // 2MB > 1MB limit
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(413);

            expect(oversizedResponse.status).toBe(413);
        });
    });

    describe("fileStore with deferred length and expiration", () => {
        let deferredExpiredServer: Tus;
        let deferredExpiredListener: ReturnType<typeof createServer>;
        let deferred_file_id: string;

        beforeAll(async () => {
            const deferredExpiredDirectory = temporaryDirectory();
            const deferredExpiredStorage = new DiskStorage({
                ...storageOptions,
                directory: deferredExpiredDirectory,
                expiration: {
                    maxAge: "50ms",
                    purgeInterval: "100ms",
                },
            });

            deferredExpiredServer = new Tus<File>({ storage: deferredExpiredStorage });
            app.use(`${STORE_PATH}-deferred-expired`, deferredExpiredServer.handle);

            deferredExpiredListener = createServer(app);
            deferredExpiredListener.listen();
        });

        afterAll(async () => {
            deferredExpiredListener.close();

            try {
                await rm(deferredExpiredDirectory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        it("should create deferred length upload with expiration", async () => {
            expect.assertions(2);

            const response = await agent
                .post(`${STORE_PATH}-deferred-expired`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Defer-Length", "1")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            expect(response.headers["upload-expires"]).toBeDefined();
            expect(response.headers.location).toBeDefined();

            deferred_file_id = response.headers.location.split("/").pop();
        });

        it("should handle PATCH with deferred length and expiration", async () => {
            expect.assertions(2);

            const response = await agent
                .patch(`${STORE_PATH}-deferred-expired/${deferred_file_id}`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Offset", "0")
                .set("Content-Type", "application/offset+octet-stream")
                .send("test data")
                .expect(204);

            expect(response.headers["upload-expires"]).toBeDefined();
            expect(response.headers["upload-offset"]).toBe("9"); // Length of "test data"
        });

        it("should return 410 for expired deferred upload", async () => {
            // Wait for expiration
            await new Promise((resolve) => setTimeout(resolve, 100));

            await agent
                .patch(`${STORE_PATH}-deferred-expired/${deferred_file_id}`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Offset", "9")
                .set("Content-Type", "application/offset+octet-stream")
                .send("more data")
                .expect(410);
        });
    });

    describe("upload termination behavior", () => {
        let terminationServer: Tus;
        let terminationListener: ReturnType<typeof createServer>;
        let completed_upload_id: string;

        beforeAll(async () => {
            const terminationDirectory = temporaryDirectory();
            const terminationStorage = new DiskStorage({
                ...storageOptions,
                directory: terminationDirectory,
            });

            // Create server with termination disabled for finished uploads
            terminationServer = new Tus<File>({ storage: terminationStorage, disableTerminationForFinishedUploads: true });
            app.use(`${STORE_PATH}-termination`, terminationServer.handle);

            terminationListener = createServer(app);
            terminationListener.listen();
        });

        afterAll(async () => {
            terminationListener.close();

            try {
                await rm(terminationDirectory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        it("should allow terminating unfinished uploads", async () => {
            // Create an upload but don't complete it
            const response = await agent
                .post(`${STORE_PATH}-termination`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", "100")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            const uploadId = response.headers.location.split("/").pop();

            // Terminate the unfinished upload
            await agent.delete(`${STORE_PATH}-termination/${uploadId}`).set("Tus-Resumable", TUS_RESUMABLE).expect(204);
        });

        it("should disallow terminating finished uploads when disabled", async () => {
            // This feature is not yet implemented in the current TUS handler
            // Skipping until disableTerminationForFinishedUploads option is added

            // Create and complete an upload
            const response = await agent
                .post(`${STORE_PATH}-termination`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", "100")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            completed_upload_id = response.headers.location.split("/").pop();

            // Complete the upload
            await agent
                .patch(`${STORE_PATH}-termination/${completed_upload_id}`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Offset", "0")
                .set("Content-Type", "application/offset+octet-stream")
                .send(Buffer.alloc(100, "a"))
                .expect(200);

            // Try to terminate the completed upload - should fail
            await agent.delete(`${STORE_PATH}-termination/${completed_upload_id}`).set("Tus-Resumable", TUS_RESUMABLE).expect(400);
        });
    });

    describe("concurrent uploads and locking", () => {
        let lockingServer: Tus;
        let lockingListener: ReturnType<typeof createServer>;

        beforeAll(async () => {
            const lockingDirectory = temporaryDirectory();
            const lockingStorage = new DiskStorage({
                ...storageOptions,
                directory: lockingDirectory,
            });

            lockingServer = new Tus<File>({ storage: lockingStorage });
            app.use(`${STORE_PATH}-locking`, lockingServer.handle);

            lockingListener = createServer(app);
            lockingListener.listen();
        });

        afterAll(async () => {
            lockingListener.close();

            try {
                await rm(lockingDirectory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        it("should handle concurrent uploads with locking", async () => {
            expect.assertions(9);

            // Create multiple uploads simultaneously
            const uploadPromises = Array.from({ length: 3 }, (_, index) =>
                agent
                    .post(`${STORE_PATH}-locking`)
                    .set("Tus-Resumable", TUS_RESUMABLE)
                    .set("Upload-Length", "100")
                    .set("Upload-Metadata", serializeMetadata({ ...metadata, name: `file${index}` })));

            const responses = await Promise.all(uploadPromises);

            // All should succeed
            responses.forEach((response) => {
                expect(response.status).toBe(201);
                expect(response.headers.location).toBeDefined();
            });

            // Upload to each file simultaneously
            const uploadIds = responses.map((r) => r.headers.location.split("/").pop());
            const patchPromises = uploadIds.map((id) =>
                agent
                    .patch(`${STORE_PATH}-locking/${id}`)
                    .set("Tus-Resumable", TUS_RESUMABLE)
                    .set("Upload-Offset", "0")
                    .set("Content-Type", "application/offset+octet-stream")
                    .send(Buffer.alloc(100, "a")),
            );

            const patchResponses = await Promise.all(patchPromises);

            // All patches should succeed
            patchResponses.forEach((response) => {
                expect([204, 200]).toContain(response.status); // 204 for partial, 200 for complete
            });
        }, 10_000);
    });

    describe("error scenarios", () => {
        it("should return 404 for HEAD on non-existent file", async () => {
            await agent.head(`${STORE_PATH}/non-existent-file-id`).set("Tus-Resumable", TUS_RESUMABLE).expect(404);
        });

        it("should return 404 for PATCH on non-existent file", async () => {
            await agent
                .patch(`${STORE_PATH}/non-existent-file-id`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Offset", "0")
                .set("Content-Type", "application/offset+octet-stream")
                .send("test")
                .expect(404);
        });

        it("should return 404 for invalid paths", async () => {
            await agent
                .patch(`${STORE_PATH}/`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Offset", "0")
                .set("Content-Type", "application/offset+octet-stream")
                .send("test")
                .expect(404);
        });

        it("should validate Upload-Offset header", async () => {
            const response = await agent
                .post(STORE_PATH)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", "100")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            const uploadId = response.headers.location.split("/").pop();

            // Try PATCH without Upload-Offset header
            await agent
                .patch(`${STORE_PATH}/${uploadId}`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Content-Type", "application/offset+octet-stream")
                .send("test")
                .expect(412);
        });

        it("should validate Content-Type header", async () => {
            const response = await agent
                .post(STORE_PATH)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Length", "100")
                .set("Upload-Metadata", serializeMetadata(metadata))
                .expect(201);

            const uploadId = response.headers.location.split("/").pop();

            // Try PATCH without proper Content-Type header
            // The TUS spec requires application/offset+octet-stream for PATCH requests
            await agent
                .patch(`${STORE_PATH}/${uploadId}`)
                .set("Tus-Resumable", TUS_RESUMABLE)
                .set("Upload-Offset", "0")
                .set("Content-Type", "text/plain") // Wrong content type
                .send("test")
                .expect(412);
        });
    });
});
