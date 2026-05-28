import { describe, expect, it } from "vitest";

import {
    buildChunkedUploadHeaders,
    buildErrorResponseBody,
    buildFileHeaders,
    buildFileMetadataHeaders,
    buildLocationHeader,
    buildResponseFile,
    cleanFileData,
    convertHeadersToString,
    prepareResponseBody,
} from "../../../src/handler/utils/response-builder";
import type { UploadFile } from "../../../src/storage/utils/file";

const buildFile = (overrides: Partial<UploadFile> = {}): UploadFile =>
    ({
        bytesWritten: 100,
        contentType: "video/mp4",
        id: "f1",
        metadata: {},
        name: "f1.mp4",
        originalName: "f1.mp4",
        size: 200,
        status: "created",
        ...overrides,
    }) as UploadFile;

describe("response-builder", () => {
    describe("buildResponseFile", () => {
        it("merges file with headers and default 200 status", () => {
            expect.assertions(3);

            const file = buildFile();
            const result = buildResponseFile(file, { "X-Foo": "bar" });

            expect(result.statusCode).toBe(200);
            expect(result.headers).toStrictEqual({ "X-Foo": "bar" });
            expect(result.id).toBe("f1");
        });

        it("accepts a custom status code", () => {
            expect.assertions(1);

            const file = buildFile();
            const result = buildResponseFile(file, {}, 201);

            expect(result.statusCode).toBe(201);
        });
    });

    describe("buildFileHeaders", () => {
        it("includes Location plus expiredAt + ETag when defined", () => {
            expect.assertions(3);

            const file = buildFile({ ETag: "etag1", expiredAt: 1700000000000 });
            const headers = buildFileHeaders(file, "/files/f1");

            expect(headers.Location).toBe("/files/f1");
            expect(headers["X-Upload-Expires"]).toBe("1700000000000");
            expect(headers.ETag).toBe("etag1");
        });

        it("omits ETag/expires when undefined and merges additional headers", () => {
            expect.assertions(3);

            const file = buildFile();
            const headers = buildFileHeaders(file, "/files/f1", { "X-Custom": "v" });

            expect("ETag" in headers).toBe(false);
            expect("X-Upload-Expires" in headers).toBe(false);
            expect(headers["X-Custom"]).toBe("v");
        });
    });

    describe("buildChunkedUploadHeaders", () => {
        it("emits required chunked headers with isComplete flag", () => {
            expect.assertions(3);

            const file = buildFile({ bytesWritten: 1024 });
            const headers = buildChunkedUploadHeaders(file, false);

            expect(headers["x-chunked-upload"]).toBe("true");
            expect(headers["x-upload-complete"]).toBe("false");
            expect(headers["x-upload-offset"]).toBe("1024");
        });

        it("includes received chunks when present in metadata", () => {
            expect.assertions(1);

            const file = buildFile({ metadata: { _chunks: [0, 1, 2] } });
            const headers = buildChunkedUploadHeaders(file, true);

            expect(headers["x-received-chunks"]).toBe(JSON.stringify([0, 1, 2]));
        });
    });

    describe("buildLocationHeader", () => {
        it("returns a relative URL when useRelativeLocation is true", () => {
            expect.assertions(1);

            const url = buildLocationHeader("/uploads", "abc", "video/mp4", true);

            expect(url).toBe("/uploads/abc.mp4");
        });

        it("prefixes the baseUrl when useRelativeLocation is false", () => {
            expect.assertions(1);

            const url = buildLocationHeader("/uploads", "abc", "video/mp4", false, "https://cdn.example.com");

            expect(url).toBe("https://cdn.example.com/uploads/abc.mp4");
        });

        it("falls back to '/' when requestUrl is undefined", () => {
            expect.assertions(1);

            const url = buildLocationHeader(undefined, "abc", "image/png", true);

            expect(url).toBe("//abc.png");
        });
    });

    describe("buildFileMetadataHeaders", () => {
        it("emits Content-Length and Content-Type", () => {
            expect.assertions(2);

            const file = buildFile({ size: 4242 });
            const headers = buildFileMetadataHeaders(file);

            expect(headers["Content-Length"]).toBe("4242");
            expect(headers["Content-Type"]).toBe("video/mp4");
        });

        it("includes Last-Modified, ETag, and X-Upload-Expires when defined", () => {
            expect.assertions(3);

            const file = buildFile({ ETag: "etag", expiredAt: 1, modifiedAt: "2024-01-01" });
            const headers = buildFileMetadataHeaders(file);

            expect(headers["Last-Modified"]).toBe("2024-01-01");
            expect(headers.ETag).toBe("etag");
            expect(headers["X-Upload-Expires"]).toBe("1");
        });
    });

    describe("convertHeadersToString", () => {
        it("converts arrays into comma-separated strings", () => {
            expect.assertions(2);

            const headers = convertHeadersToString({
                "X-Foo": ["a", "b"],
                "X-Bar": "single",
            });

            expect(headers["X-Foo"]).toBe("a, b");
            expect(headers["X-Bar"]).toBe("single");
        });
    });

    describe("buildErrorResponseBody", () => {
        it("falls back to defaults when error fields are missing", () => {
            expect.assertions(3);

            const body = buildErrorResponseBody({});

            expect(body.error.code).toBe("Error");
            expect(body.error.message).toBe("Unknown error");
            expect(body.error.name).toBe("Error");
        });

        it("uses error.code or error.name", () => {
            expect.assertions(2);

            const a = buildErrorResponseBody({ code: "BAD_REQUEST", message: "Bad" });
            const b = buildErrorResponseBody({ message: "Bad", name: "BadError" });

            expect(a.error.code).toBe("BAD_REQUEST");
            expect(b.error.code).toBe("BadError");
        });
    });

    describe("prepareResponseBody", () => {
        it("serialises strings and sets text/plain by default", () => {
            expect.assertions(3);

            const { data, headers } = prepareResponseBody("hello");

            expect(data).toBe("hello");
            expect(String(headers["Content-Type"])).toContain("text/plain");
            expect(headers["Content-Length"]).toBe(5);
        });

        it("preserves a Buffer body untouched", () => {
            expect.assertions(1);

            const buffer = Buffer.from("payload");
            const { data } = prepareResponseBody(buffer);

            expect(data).toBe(buffer);
        });

        it("serialises objects to JSON with application/json content-type", () => {
            expect.assertions(2);

            const { data, headers } = prepareResponseBody({ foo: "bar" });

            expect(data).toBe(JSON.stringify({ foo: "bar" }));
            expect(String(headers["Content-Type"])).toContain("application/json");
        });

        it("ensures charset on existing string content type", () => {
            expect.assertions(1);

            const { headers } = prepareResponseBody("hi", { "Content-Type": "text/html" });

            expect(String(headers["Content-Type"]).toLowerCase()).toContain("charset");
        });
    });

    describe("cleanFileData", () => {
        it("removes content and stream properties from file data", () => {
            expect.assertions(2);

            const file = { ...buildFile(), content: Buffer.alloc(0), stream: {} } as unknown;
            const cleaned = cleanFileData(file as never) as Record<string, unknown>;

            expect("content" in cleaned).toBe(false);
            expect("stream" in cleaned).toBe(false);
        });
    });
});
