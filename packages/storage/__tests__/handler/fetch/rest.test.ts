import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Rest from "../../../src/handler/rest";
import DiskStorage from "../../../src/storage/local/disk-storage";
import { storageOptions, testfile } from "../../__helpers__/config";
import { waitForStorageReady } from "../../__helpers__/utils";

describe("fetch Rest", () => {
    const basePath = "http://localhost/rest/";

    const create = (storage: DiskStorage): Request => {
        // Create a Blob from the buffer for proper Web API Request body handling
        const blob = new Blob([testfile.asBuffer], { type: testfile.contentType });

        return new Request(basePath.toString(), {
            body: blob,
            headers: {
                "content-length": String(testfile.size),
                "content-type": testfile.contentType,
            },
            method: "POST",
        });
    };

    describe("default options", () => {
        it("should create Rest handler instance", () => {
            expect.assertions(1);

            expect(new Rest({ storage: new DiskStorage({ directory: "/files" }) })).toBeInstanceOf(Rest);
        });
    });

    describe("post", () => {
        it("should upload file with raw binary data", async () => {
            expect.assertions(2);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, allowMIME: ["video/mp4", "image/*", "application/octet-stream"], directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            const request = create(storage);
            const response = await restHandler.fetch(request);

            expect(response.status).toBe(201);
            expect(response.headers.get("location")).toBeDefined();

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });

        it("should upload file with Content-Disposition header", async () => {
            expect.assertions(2);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            const blob = new Blob([testfile.asBuffer], { type: testfile.contentType });

            const request = new Request(basePath.toString(), {
                body: blob,
                headers: {
                    "content-disposition": `attachment; filename="${testfile.name}"`,
                    "content-length": String(testfile.size),
                    "content-type": testfile.contentType,
                },
                method: "POST",
            });

            const response = await restHandler.fetch(request);
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body.originalName).toBe(testfile.name);

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });

        it("should upload file with metadata header", async () => {
            expect.assertions(2);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            const metadata = { description: "Test file" };
            const blob = new Blob([testfile.asBuffer], { type: testfile.contentType });

            const request = new Request(basePath.toString(), {
                body: blob,
                headers: {
                    "content-length": String(testfile.size),
                    "content-type": testfile.contentType,
                    "x-file-metadata": JSON.stringify(metadata),
                },
                method: "POST",
            });

            const response = await restHandler.fetch(request);
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body.metadata).toMatchObject(metadata);

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });

        it("should handle invalid request with error response", async () => {
            expect.assertions(2);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            const request = new Request(basePath.toString(), {
                method: "POST",
            });

            const response = await restHandler.fetch(request);

            expect(response.status).toBe(400);

            const body = await response.json();

            expect(body.error).toBeDefined();

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });
    });

    describe("put", () => {
        it("should create file with PUT when ID doesn't exist", async () => {
            expect.assertions(2);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            // Use a valid UUID-like ID format (two dashes)
            const fileId = "123-456-789";
            const blob = new Blob([testfile.asBuffer], { type: testfile.contentType });

            const request = new Request(`${basePath}${fileId}`, {
                body: blob,
                headers: {
                    "content-length": String(testfile.size),
                    "content-type": testfile.contentType,
                },
                method: "PUT",
            });

            const response = await restHandler.fetch(request);

            // When file doesn't exist, PUT creates a new file with storage-generated ID
            expect(response.status).toBe(201);
            expect(response.headers.get("location")).toBeDefined();

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });

        it("should update file with PUT when ID exists", async () => {
            expect.assertions(1);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            // First create a file
            const createRequest = create(storage);
            const createResponse = await restHandler.fetch(createRequest);
            const createBody = await createResponse.json();
            const fileId = createBody.id;

            // Then update it with PUT
            const updatedContent = Buffer.from("updated content");
            const updateBlob = new Blob([updatedContent], { type: "text/plain" });

            const updateRequest = new Request(`${basePath}${fileId}`, {
                body: updateBlob,
                headers: {
                    "content-length": String(updatedContent.length),
                    "content-type": "text/plain",
                },
                method: "PUT",
            });

            const updateResponse = await restHandler.fetch(updateRequest);

            expect(updateResponse.status).toBe(200);

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });
    });

    describe("options", () => {
        it("should return 204 with proper CORS headers for OPTIONS request", async () => {
            expect.assertions(3);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            const request = new Request(basePath.toString(), {
                method: "OPTIONS",
            });

            const response = await restHandler.fetch(request);

            expect(response.status).toBe(204);
            expect(response.headers.get("access-control-allow-methods")).toContain("POST");
            expect(response.headers.get("x-max-upload-size")).toBeDefined();

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });
    });

    describe("head", () => {
        it("should return file metadata", async () => {
            expect.assertions(4);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            // Create a file first
            const createRequest = create(storage);
            const createResponse = await restHandler.fetch(createRequest);
            const createBody = await createResponse.json();
            const fileId = createBody.id;

            const headRequest = new Request(`${basePath}${fileId}`, {
                method: "HEAD",
            });

            const response = await restHandler.fetch(headRequest);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-length")).toBeDefined();
            expect(response.headers.get("content-type")).toBeDefined();
            expect(response.headers.get("content-length")).toBe(String(testfile.size));

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });

        it("should return 404 for non-existent file", async () => {
            expect.assertions(1);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            const request = new Request(`${basePath}non-existent-id`, {
                method: "HEAD",
            });

            const response = await restHandler.fetch(request);

            expect(response.status).toBe(404);

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });
    });

    describe("delete", () => {
        it("should successfully delete uploaded file", async () => {
            expect.assertions(1);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            // Create a file first
            const createRequest = create(storage);
            const createResponse = await restHandler.fetch(createRequest);
            const createBody = await createResponse.json();
            const fileId = createBody.id;

            const deleteRequest = new Request(`${basePath}${fileId}`, {
                method: "DELETE",
            });

            const response = await restHandler.fetch(deleteRequest);

            expect(response.status).toBe(204);

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });

        it("should return 404 for non-existent file deletion", async () => {
            expect.assertions(1);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            const request = new Request(`${basePath}1d2a1da2s-1d5as45d5a-4d5asd`, {
                method: "DELETE",
            });

            const response = await restHandler.fetch(request);

            expect(response.status).toBe(404);

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });

        it("should batch delete files via query parameter", async () => {
            expect.assertions(1);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            // Create multiple files
            const file1Response = await restHandler.fetch(create(storage));
            const file2Response = await restHandler.fetch(create(storage));
            const file3Response = await restHandler.fetch(create(storage));

            const file1Body = await file1Response.json();
            const file2Body = await file2Response.json();
            const file3Body = await file3Response.json();

            const ids = [file1Body.id, file2Body.id, file3Body.id].join(",");

            const deleteRequest = new Request(`${basePath}?ids=${ids}`, {
                method: "DELETE",
            });

            const response = await restHandler.fetch(deleteRequest);

            expect(response.status).toBe(204);

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });

        it("should batch delete files via JSON body", async () => {
            expect.assertions(1);

            const directory = temporaryDirectory();
            const storage = new DiskStorage({ ...storageOptions, directory });
            const restHandler = new Rest({ storage });

            await waitForStorageReady(storage);

            // Create multiple files
            const file1Response = await restHandler.fetch(create(storage));
            const file2Response = await restHandler.fetch(create(storage));

            const file1Body = await file1Response.json();
            const file2Body = await file2Response.json();

            const ids = [file1Body.id, file2Body.id];

            const deleteRequest = new Request(basePath.toString(), {
                body: JSON.stringify({ ids }),
                headers: {
                    "content-type": "application/json",
                },
                method: "DELETE",
            });

            const response = await restHandler.fetch(deleteRequest);

            expect(response.status).toBe(204);

            await rm(directory, { force: true, recursive: true }).catch(() => {});
        });
    });
});
