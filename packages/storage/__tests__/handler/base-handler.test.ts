import { rm } from "node:fs/promises";
import { Readable } from "node:stream";

import { createRequest, createResponse } from "node-mocks-http";
import { temporaryDirectory } from "tempy";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import DiskStorage from "../../src/storage/local/disk-storage";
import { storageOptions } from "../__helpers__/config";
import TestUploader from "../__helpers__/handler/test-uploader";
import MockLogger from "../__helpers__/mock-logger";

describe("baseHandler", () => {
    let directory: string;
    let storage: DiskStorage;

    let uploader: TestUploader;

    beforeAll(async () => {
        directory = temporaryDirectory();
        storage = new DiskStorage({ ...storageOptions, directory, logger: console });

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

    beforeEach(async () => {
        uploader = new TestUploader({ storage });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("baseHandler.compose registers correct HTTP methods as handlers", () => {
        expect.assertions(2);

        const logger = new MockLogger();

        uploader = new TestUploader({ storage: new DiskStorage({ ...storageOptions, directory, logger }) });

        expect(logger.debug).toHaveBeenCalledTimes(2);
        expect(logger.debug).toHaveBeenCalledWith("Registered handler: %s", "GET, OPTIONS, DOWNLOAD");
    });

    it("baseHandler.errorResponses setter updates internalErrorResponses correctly", () => {
        expect.assertions(1);

        uploader.errorResponses = { FileNotFound: { message: "Not Found!", statusCode: 404 } };

        expect(uploader.errorResponses.FileNotFound).toStrictEqual({ message: "Not Found!", statusCode: 404 });
    });

    it("baseHandler.assembleErrors merges default and custom error responses correctly", () => {
        expect.assertions(2);

        const errorObject = { message: "Not Found!", statusCode: 404 };

        uploader.assembleErrors({ FileNotFound: errorObject });

        expect(uploader.errorResponses.FileNotFound).toStrictEqual(errorObject);
        expect(uploader.errorResponses.InvalidRange).toStrictEqual({
            code: "InvalidRange",
            message: "Invalid or missing content-range header",
            statusCode: 400,
        });
    });

    it("should call correct handler based on HTTP request method", async () => {
        expect.assertions(2);

        const getHandler = vi.fn(() => Promise.resolve({}));

        uploader.handlers.set("GET", getHandler);

        const request = createRequest({ method: "GET" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(getHandler).toHaveBeenCalledTimes(1);
        expect(getHandler).toHaveBeenCalledWith(request, response);
    });

    it("should return list of uploaded files via GET request", async () => {
        expect.assertions(1);

        const request = createRequest({ method: "GET", url: "/files" });
        const response = createResponse();

        await uploader.handle(request, response);

        // eslint-disable-next-line no-underscore-dangle
        expect(response._getStatusCode()).toBe(200);
    });

    it("should implement OPTIONS method with correct CORS headers", async () => {
        expect.assertions(2);

        const response = createResponse();
        const request = createRequest({ url: "/files" });

        const file = await uploader.options(request, response);

        expect(file.statusCode).toBe(204);
        expect(file.headers).toStrictEqual({ "Access-Control-Allow-Methods": "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT" });
    });

    it("should return 503 when storage is not ready", async () => {
        expect.assertions(1);

        uploader.storage.isReady = false;

        const response = createResponse();

        await uploader.handle(createRequest({ method: "OPTIONS" }), response);

        expect(response.statusCode).toBe(503);

        uploader.storage.isReady = true;
    });

    it("should return 405 for unsupported HTTP methods", async () => {
        expect.assertions(1);

        const response = createResponse();

        await uploader.handle(createRequest({ method: "PATCH" }), response);

        expect(response.statusCode).toBe(405);
    });

    it("should handle GET requests for file listings", async () => {
        expect.assertions(1);

        const request = createRequest({ method: "GET", url: "/files" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(response.statusCode).toBe(200);
    });

    it("should handle GET requests for specific file IDs", async () => {
        expect.assertions(2);

        const request = createRequest({ method: "GET", url: "/files/111" });
        let response = createResponse();

        await uploader.handle(request, response);

        expect(response.statusCode).toBe(200);

        response = createResponse();

        await uploader.get(request, response);

        expect(response.statusCode).toBe(200);
    });

    it("should handle GET requests with query parameters", async () => {
        expect.assertions(1);

        const request = createRequest({ method: "GET", url: "/files/111?name=foo" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(response.statusCode).toBe(200);
    });

    it("should handle GET requests with empty query parameters", async () => {
        expect.assertions(1);

        const request = createRequest({ method: "GET", url: "/files/111?name=" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(response.statusCode).toBe(200);
    });

    it("should handle GET requests for file metadata", async () => {
        expect.assertions(2);

        // Spy on storage.getMeta to return a file
        const spy = vi.spyOn(storage, "getMeta").mockResolvedValueOnce({
            bytesWritten: 100,
            contentType: "application/json",
            createdAt: new Date(),
            id: "123-456-789",
            metadata: {},
            name: "test.json",
            originalName: "test.json",
            size: 100,
            status: "completed" as const,
        });

        const request = createRequest({ method: "GET", url: "/files/123-456-789/metadata" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(spy).toHaveBeenCalledWith("123-456-789");
        expect(response.statusCode).toBe(200);

        spy.mockRestore();
    });

    it("should handle GET requests for non-existent file metadata", async () => {
        expect.assertions(1);

        // Spy on storage.getMeta to throw FileNotFound error
        const error = new Error("Not found") as Error & { UploadErrorCode?: string };

        error.UploadErrorCode = "FileNotFound";
        const spy = vi.spyOn(storage, "getMeta").mockRejectedValueOnce(error);

        const request = createRequest({ method: "GET", url: "/files/999-999-999/metadata" });
        const response = createResponse();

        await uploader.handle(request, response);

        expect(response.statusCode).toBe(404);

        spy.mockRestore();
    });

    it("should send error responses in JSON format", async () => {
        expect.assertions(2);

        uploader.responseType = "json";

        const response = createResponse();
        const sendSpy = vi.spyOn(uploader, "send");
        const error = new Error("Error Message");

        await uploader.sendError(response, error);

        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy).toHaveBeenCalledWith(response, {
            body: {
                error: {
                    code: "Error",
                    message: "[disk] Error Message",
                    name: "Error",
                },
            },
            headers: undefined,
            statusCode: 500,
        });
    });

    describe("streaming functionality", () => {
        describe("sendStream", () => {
            it("should send streaming response with proper headers", () => {
                expect.assertions(4);

                const response = createResponse();

                // Mock the listeners method to avoid undefined error
                vi.spyOn(response, "listeners").mockReturnValue([]);
                vi.spyOn(response, "on").mockImplementation(() => response);

                const stream = Readable.from(Buffer.from("test data"));

                uploader.sendStream(response, stream, {
                    headers: { "content-type": "text/plain" },
                    statusCode: 200,
                });

                expect(response.statusCode).toBe(200);
                expect(response.getHeader("content-type")).toBe("text/plain");
                expect(response.getHeader("content-length")).toBeUndefined(); // Should not set for streams
                expect(response.getHeader("accept-ranges")).toBe("bytes"); // Always advertise range support
            });

            it("should handle range requests with proper headers", () => {
                expect.assertions(4);

                const response = createResponse();

                // Mock the listeners method to avoid undefined error
                vi.spyOn(response, "listeners").mockReturnValue([]);
                vi.spyOn(response, "on").mockImplementation(() => response);

                const stream = Readable.from(Buffer.from("test data"));

                uploader.sendStream(response, stream, {
                    headers: { "content-type": "text/plain" },
                    range: { end: 3, start: 0 },
                    size: 9,
                    statusCode: 200,
                });

                expect(response.statusCode).toBe(206); // Partial Content
                expect(response.getHeader("content-range")).toBe("bytes 0-3/9");
                expect(response.getHeader("content-length")).toBe(4);
                expect(response.getHeader("accept-ranges")).toBe("bytes");
            });

            it("should handle stream errors gracefully", async () => {
                expect.assertions(2);

                const response = createResponse();

                // Mock the listeners method to avoid undefined error
                vi.spyOn(response, "listeners").mockReturnValue([]);
                vi.spyOn(response, "on").mockImplementation(() => response);

                const stream = new Readable({
                    read() {
                        this.emit("error", new Error("Stream error"));
                    },
                });

                const sendErrorSpy = vi.spyOn(uploader, "sendError");

                uploader.sendStream(response, stream, {
                    headers: { "content-type": "text/plain" },
                    statusCode: 200,
                });

                // Wait for error handling
                await new Promise((resolve) => setTimeout(resolve, 10));

                expect(sendErrorSpy).toHaveBeenCalledTimes(1);
                expect(sendErrorSpy).toHaveBeenCalledWith(response, expect.any(Error));
            });
        });

        describe("parseRangeHeader", () => {
            it("should parse valid range headers correctly", () => {
                expect.assertions(3);

                expect(uploader.parseRangeHeader("bytes=0-99", 1000)).toStrictEqual({ end: 99, start: 0 });
                expect(uploader.parseRangeHeader("bytes=100-", 1000)).toStrictEqual({ end: 999, start: 100 });
                expect(uploader.parseRangeHeader("bytes=-50", 1000)).toStrictEqual({ end: 999, start: 950 });
            });

            it("should return null for invalid range headers", () => {
                expect.assertions(4);

                expect(uploader.parseRangeHeader("bytes=100-50", 1000)).toBeUndefined(); // Start > End
                expect(uploader.parseRangeHeader("bytes=1000-1100", 1000)).toBeUndefined(); // Start >= fileSize
                expect(uploader.parseRangeHeader("invalid", 1000)).toBeUndefined(); // Invalid format
                expect(uploader.parseRangeHeader("bytes=0-99,100-199", 1000)).toBeUndefined(); // Multiple ranges
            });

            it("should return null when no range header provided", () => {
                expect.assertions(1);

                expect(uploader.parseRangeHeader(undefined, 1000)).toBeUndefined();
            });
        });

        describe("download method", () => {
            it("should handle download requests for files", async () => {
                expect.assertions(2);

                // Mock storage methods
                const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                    bytesWritten: 100,
                    contentType: "application/octet-stream",
                    createdAt: new Date(),
                    id: "test-file-id",
                    metadata: {},
                    name: "test-file.txt",
                    originalName: "test-file.txt",
                    size: 100,
                    status: "completed" as const,
                });

                const getStreamSpy = vi.spyOn(storage, "getStream").mockResolvedValue({
                    headers: {
                        "Content-Length": "100",
                        "Content-Type": "application/octet-stream",
                    },
                    size: 100,
                    stream: Readable.from(Buffer.from("test content")),
                });

                const request = createRequest({
                    headers: { range: "bytes=0-49" },
                    method: "GET",
                    url: "/files/test-file-id/download",
                });
                const response = createResponse();

                // Mock the listeners method to avoid undefined error
                vi.spyOn(response, "listeners").mockReturnValue([]);
                vi.spyOn(response, "on").mockImplementation(() => response);

                await uploader.download(request, response);

                expect(getMetaSpy).toHaveBeenCalledWith("test-file-id");
                expect(getStreamSpy).toHaveBeenCalledWith({ id: "test-file-id" });
                // The response is now handled directly by sendStream
                // Status code and headers are set by sendStream method

                getMetaSpy.mockRestore();
                getStreamSpy.mockRestore();
            });

            it("should return 404 for non-existent files", async () => {
                expect.assertions(1);

                const error = new Error("Not found") as Error & { UploadErrorCode?: string };

                error.UploadErrorCode = "FileNotFound";

                const getMetaSpy = vi.spyOn(storage, "getMeta").mockRejectedValue(error);

                const request = createRequest({
                    method: "GET",
                    url: "/files/123-456-789/download",
                });
                const response = createResponse();

                // Mock the listeners method to avoid undefined error
                vi.spyOn(response, "listeners").mockReturnValue([]);
                vi.spyOn(response, "on").mockImplementation(() => response);

                await uploader.download(request, response);

                expect(response.statusCode).toBe(404);

                getMetaSpy.mockRestore();
            });

            it("should return 501 when streaming is not supported", async () => {
                expect.assertions(1);

                // Mock storage without getStream method
                const originalGetStream = storage.getStream;

                (storage as unknown as { getStream?: typeof originalGetStream }).getStream = undefined;

                const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                    bytesWritten: 100,
                    contentType: "application/octet-stream",
                    createdAt: new Date(),
                    id: "test-file-id",
                    metadata: {},
                    name: "test-file.txt",
                    originalName: "test-file.txt",
                    size: 100,
                    status: "completed" as const,
                });

                const request = createRequest({
                    method: "GET",
                    url: "/files/test-file-id/download",
                });

                const response = createResponse();

                // Mock the listeners method to avoid undefined error
                vi.spyOn(response, "listeners").mockReturnValue([]);
                vi.spyOn(response, "on").mockImplementation(() => response);

                await uploader.download(request, response);

                expect(response.statusCode).toBe(501);

                // Restore getStream method
                (storage as unknown as { getStream?: typeof originalGetStream }).getStream = originalGetStream;
                getMetaSpy.mockRestore();
            });
        });

        describe("streaming GET requests", () => {
            it("should use streaming for large files", async () => {
                expect.assertions(3);

                // Mock storage methods
                const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                    bytesWritten: 2_000_000, // 2MB file
                    contentType: "application/octet-stream",
                    createdAt: new Date(),
                    id: "large-file-id",
                    metadata: {},
                    name: "large-file.dat",
                    originalName: "large-file.dat",
                    size: 2_000_000,
                    status: "completed" as const,
                });

                const getSpy = vi.spyOn(storage, "get").mockResolvedValue({
                    bytesWritten: 2_000_000,
                    content: Buffer.from("large content"),
                    contentType: "application/octet-stream",
                    ETag: "etag123",
                    expiredAt: undefined,
                    id: "large-file-id",
                    metadata: {},
                    modifiedAt: new Date(),
                    name: "large-file.dat",
                    originalName: "large-file.dat",
                    size: 2_000_000,
                });

                const getStreamSpy = vi.spyOn(storage, "getStream").mockResolvedValue({
                    headers: {
                        "content-length": "2000000",
                        "content-type": "application/octet-stream",
                    },
                    size: 2_000_000,
                    stream: Readable.from(Buffer.from("large content")),
                });

                const request = createRequest({
                    method: "GET",
                    url: "/files/large-file-id",
                });
                const response = createResponse();

                // Mock the listeners method to avoid undefined error
                vi.spyOn(response, "listeners").mockReturnValue([]);
                vi.spyOn(response, "on").mockImplementation(() => response);

                await uploader.handle(request, response);

                expect(getMetaSpy).toHaveBeenCalledWith("large-file-id");
                expect(getStreamSpy).toHaveBeenCalledWith({ id: "large-file-id" });
                // For large files, streaming should be used (not buffer-based get)
                expect(getSpy).not.toHaveBeenCalled();

                getMetaSpy.mockRestore();
                getStreamSpy.mockRestore();
                getSpy.mockRestore();
            });

            it("should use regular buffer serving for small files", async () => {
                expect.assertions(3);

                // Mock storage methods
                const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                    bytesWritten: 1000,
                    contentType: "text/plain",
                    createdAt: new Date(),
                    id: "small-file-id",
                    metadata: {},
                    name: "small-file.txt",
                    originalName: "small-file.txt",
                    size: 1000, // Small file < 1MB
                    status: "completed" as const,
                });

                const getSpy = vi.spyOn(storage, "get").mockResolvedValue({
                    bytesWritten: 1000,
                    content: Buffer.from("small content"),
                    contentType: "text/plain",
                    ETag: "etag123",
                    expiredAt: undefined,
                    id: "small-file-id",
                    metadata: {},
                    modifiedAt: new Date(),
                    name: "small-file.txt",
                    originalName: "small-file.txt",
                    size: 1000, // Small file < 1MB
                });

                const request = createRequest({
                    method: "GET",
                    url: "/files/small-file-id",
                });
                const response = createResponse();

                // Mock the listeners method to avoid undefined error
                vi.spyOn(response, "listeners").mockReturnValue([]);
                vi.spyOn(response, "on").mockImplementation(() => response);

                await uploader.handle(request, response);

                expect(getSpy).toHaveBeenCalledWith({ id: "small-file-id" });
                expect(response.statusCode).toBe(200);
                expect(response.getHeader("content-type")).toBe("text/plain");

                getMetaSpy.mockRestore();
                getSpy.mockRestore();
            });

            it("should fall back to buffer serving when streaming fails", async () => {
                expect.assertions(4);

                // Mock storage methods - getMeta returns large file, but getStream fails
                const getMetaSpy = vi.spyOn(storage, "getMeta").mockResolvedValue({
                    bytesWritten: 2_000_000, // 2MB file
                    contentType: "application/octet-stream",
                    createdAt: new Date(),
                    id: "large-file-id",
                    metadata: {},
                    name: "large-file.dat",
                    originalName: "large-file.dat",
                    size: 2_000_000,
                    status: "completed" as const,
                });

                const getStreamSpy = vi.spyOn(storage, "getStream").mockRejectedValue(new Error("Streaming failed"));
                const getSpy = vi.spyOn(storage, "get").mockResolvedValue({
                    bytesWritten: 2_000_000,
                    content: Buffer.from("fallback content"),
                    contentType: "application/octet-stream",
                    ETag: "etag123",
                    expiredAt: undefined,
                    id: "large-file-id",
                    metadata: {},
                    modifiedAt: new Date(),
                    name: "large-file.dat",
                    originalName: "large-file.dat",
                    size: 2_000_000,
                });

                const loggerSpy = vi.spyOn(uploader.loggerInstance || console, "warn").mockImplementation(() => {});

                const request = createRequest({
                    method: "GET",
                    url: "/files/large-file-id",
                });
                const response = createResponse();

                // Mock the listeners method to avoid undefined error
                vi.spyOn(response, "listeners").mockReturnValue([]);
                vi.spyOn(response, "on").mockImplementation(() => response);

                await uploader.handle(request, response);

                expect(getMetaSpy).toHaveBeenCalledWith("large-file-id");
                expect(getStreamSpy).toHaveBeenCalledWith({ id: "large-file-id" });
                expect(getSpy).toHaveBeenCalledWith({ id: "large-file-id" });
                expect(loggerSpy).toHaveBeenCalledWith("Streaming failed, falling back to buffer: Error: Streaming failed");

                getMetaSpy.mockRestore();
                getStreamSpy.mockRestore();
                getSpy.mockRestore();
                loggerSpy.mockRestore();
            });
        });
    });
});
