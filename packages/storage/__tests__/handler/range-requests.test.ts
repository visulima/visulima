import { rm, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";

import { createRequest, createResponse } from "node-mocks-http";
import { temporaryDirectory } from "tempy";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import DiskStorage from "../../src/storage/local/disk-storage";
import { storageOptions } from "../__helpers__/config";
import TestUploader from "../__helpers__/handler/test-uploader";

describe("range request functionality", () => {
    let uploader: TestUploader;
    let directory: string;
    let storage: DiskStorage;

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
    });

    afterAll(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    beforeEach(() => {
        uploader = new TestUploader({ storage });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("range header parsing", () => {
        it("should parse valid range headers correctly", () => {
            expect.assertions(4);

            expect(uploader.parseRangeHeader("bytes=0-99", 1000)).toStrictEqual({ end: 99, start: 0 });
            expect(uploader.parseRangeHeader("bytes=100-199", 1000)).toStrictEqual({ end: 199, start: 100 });
            expect(uploader.parseRangeHeader("bytes=950-", 1000)).toStrictEqual({ end: 999, start: 950 });
            expect(uploader.parseRangeHeader("bytes=-50", 1000)).toStrictEqual({ end: 999, start: 950 });
        });

        it("should return null for invalid range headers", () => {
            expect.assertions(6);

            expect(uploader.parseRangeHeader("bytes=200-100", 1000)).toBeNull(); // Start > End
            expect(uploader.parseRangeHeader("bytes=1000-1100", 1000)).toBeNull(); // Start >= fileSize
            expect(uploader.parseRangeHeader("bytes=500-1500", 1000)).toBeNull(); // End >= fileSize
            expect(uploader.parseRangeHeader("invalid", 1000)).toBeNull(); // Invalid format
            expect(uploader.parseRangeHeader("bytes=0-99,100-199", 1000)).toBeNull(); // Multiple ranges
            expect(uploader.parseRangeHeader("range=0-99", 1000)).toBeNull(); // Wrong prefix
        });

        it("should handle edge cases", () => {
            expect.assertions(3);

            expect(uploader.parseRangeHeader("bytes=0-0", 1000)).toStrictEqual({ end: 0, start: 0 }); // Single byte
            expect(uploader.parseRangeHeader("bytes=999-999", 1000)).toStrictEqual({ end: 999, start: 999 }); // Last byte
            expect(uploader.parseRangeHeader("bytes=-1", 1000)).toStrictEqual({ end: 999, start: 999 }); // Last byte
        });
    });

    describe("streaming with range requests", () => {
        it("should handle range requests for streaming downloads", async () => {
            expect.assertions(4);

            // Mock storage methods
            const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                bytesWritten: 1000,
                contentType: "application/octet-stream",
                createdAt: new Date(),
                id: "range-test-file",
                metadata: {},
                name: "range-test.dat",
                originalName: "range-test.dat",
                size: 1000,
                status: "completed" as const,
            });

            const getStreamSpy = vi.spyOn(storage, "getStream").mockResolvedValue({
                headers: {
                    "content-length": "1000",
                    "content-type": "application/octet-stream",
                },
                size: 1000,
                stream: Readable.from(Buffer.from("x".repeat(1000))),
            });

            const request = createRequest({
                headers: { range: "bytes=100-299" }, // Request bytes 100-299 (200 bytes)
                method: "GET",
                url: "/files/range-test-file",
            });
            const response = createResponse();

            await uploader.handle(request, response);

            expect(getMetaSpy).toHaveBeenCalledWith("range-test-file");
            expect(getStreamSpy).toHaveBeenCalledWith({ id: "range-test-file" });
            expect(response.statusCode).toBe(206); // Partial content for range requests
            expect(response.getHeader("accept-ranges")).toBe("bytes");

            getMetaSpy.mockRestore();
            getStreamSpy.mockRestore();
        });

        it("should handle suffix range requests", async () => {
            expect.assertions(2);

            const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                bytesWritten: 1000,
                contentType: "text/plain",
                createdAt: new Date(),
                id: "e8fed598250d10ea-7f59007b4b7cf67-suffix",
                metadata: {},
                name: "suffix-test.txt",
                originalName: "suffix-test.txt",
                size: 1000,
                status: "completed" as const,
            });

            const getStreamSpy = vi.spyOn(storage, "getStream").mockResolvedValue({
                headers: { "content-type": "text/plain" },
                size: 1000,
                stream: Readable.from(Buffer.from("x".repeat(1000))),
            });

            const request = createRequest({
                headers: { range: "bytes=-100" }, // Last 100 bytes
                method: "GET",
                url: "/files/e8fed598250d10ea-7f59007b4b7cf67-suffix",
            });
            const response = createResponse();

            await uploader.handle(request, response);

            expect(response.statusCode).toBe(206); // Partial content for range requests
            expect(response.getHeader("accept-ranges")).toBe("bytes");

            getMetaSpy.mockRestore();
            getStreamSpy.mockRestore();
        });

        it("should handle prefix range requests", async () => {
            expect.assertions(2);

            const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                bytesWritten: 1000,
                contentType: "text/plain",
                createdAt: new Date(),
                id: "e8fed598250d10ea-7f59007b4b7cf67-prefix",
                metadata: {},
                name: "prefix-test.txt",
                originalName: "prefix-test.txt",
                size: 1000,
                status: "completed" as const,
            });

            const getStreamSpy = vi.spyOn(storage, "getStream").mockResolvedValue({
                headers: { "content-type": "text/plain" },
                size: 1000,
                stream: Readable.from(Buffer.from("x".repeat(1000))),
            });

            const request = createRequest({
                headers: { range: "bytes=500-" }, // From byte 500 to end
                method: "GET",
                url: "/files/e8fed598250d10ea-7f59007b4b7cf67-prefix",
            });
            const response = createResponse();

            await uploader.handle(request, response);

            expect(response.statusCode).toBe(206); // Partial content for range requests
            expect(response.getHeader("accept-ranges")).toBe("bytes");

            getMetaSpy.mockRestore();
            getStreamSpy.mockRestore();
        });

        it("should return 200 for invalid range headers", async () => {
            expect.assertions(2);

            // Create the actual file on disk
            const filePath = `${directory}/invalid-range-test`;

            await writeFile(filePath, "x".repeat(1000)); // Create 1000 byte file

            // Create metadata file
            const metaPath = `${directory}/invalid-range-test.META`;

            await writeFile(
                metaPath,
                JSON.stringify({
                    bytesWritten: 1000,
                    contentType: "text/plain",
                    createdAt: new Date().toISOString(),
                    id: "invalid-range-test",
                    metadata: {},
                    name: "invalid-range-test.txt",
                    originalName: "invalid-range-test.txt",
                    size: 1000,
                    status: "completed",
                }),
            );

            const request = createRequest({
                headers: { range: "bytes=200-100" }, // Invalid: start > end
                method: "GET",
                url: "/files/invalid-range-test",
            });
            const response = createResponse();

            await uploader.handle(request, response);

            // Should fall back to regular 200 response for invalid range
            expect(response.statusCode).toBe(200);
            expect(response.getHeader("accept-ranges")).toBe("bytes"); // Still advertise range support
        });
    });

    describe("download method with ranges", () => {
        it("should handle range requests in download method", async () => {
            expect.assertions(3);

            const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                bytesWritten: 1000,
                contentType: "application/octet-stream",
                createdAt: new Date(),
                id: "download-range-test",
                metadata: {},
                name: "download-range-test.dat",
                originalName: "download-range-test.dat",
                size: 1000,
                status: "completed" as const,
            });

            const getStreamSpy = vi.spyOn(storage, "getStream").mockResolvedValue({
                headers: { "content-type": "application/octet-stream" },
                size: 1000,
                stream: Readable.from(Buffer.from("x".repeat(1000))),
            });

            const request = createRequest({
                headers: { range: "bytes=0-99" }, // First 100 bytes
                method: "GET",
                url: "/files/download-range-test/download",
            });
            const response = createResponse();

            await uploader.download(request, response);

            expect(response.statusCode).toBe(206); // Partial content for range requests
            expect(response.getHeader("content-disposition")).toBe("attachment; filename=\"download-range-test.dat\"");
            expect(response.getHeader("accept-ranges")).toBe("bytes");

            getMetaSpy.mockRestore();
            getStreamSpy.mockRestore();
        });
    });
});
