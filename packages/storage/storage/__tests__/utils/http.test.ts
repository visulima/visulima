import type { IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";

import httpMocks, { createRequest } from "node-mocks-http";
import { describe, expect, it, vi } from "vitest";

import {
    appendHeader,
    extractHost,
    extractProto,
    getBaseUrl,
    getHeader,
    getIdFromRequest,
    getIdFromRequestUrl,
    getMetadata,
    getRealPath,
    MAX_DRAIN_MS,
    readBody,
    readWebRequestText,
    setHeaders,
} from "../../src/utils/http";
import { createRequest as httpCreateRequest } from "../__helpers__/utils";

describe("utils", () => {
    describe("http", () => {
        const mime = "application/vnd+json";
        const request = httpMocks.createRequest({
            headers: { "content-type": mime },
            method: "GET",
        });
        const response = httpMocks.createResponse({});

        it("should return empty string for non-existent header", () => {
            expect.assertions(1);

            expect(getHeader(request, "not exist")).toBe("");
        });

        it("should return header value for single header", () => {
            expect.assertions(1);

            request.headers = { head: "value" };

            expect(getHeader(request, "head")).toBe("value");
        });

        it("should return last header value or concatenated values for multiple headers", () => {
            expect.assertions(2);

            request.headers = { head: ["value1", "value2"] };

            expect(getHeader(request, "head")).toBe("value2");
            expect(getHeader(request, "head", true)).toBe("value1,value2");
        });

        it("should return empty string when no host is present", () => {
            expect.assertions(1);

            expect(getBaseUrl(request)).toBe("");
        });

        it("should construct base URL with protocol-relative format when no protocol specified", () => {
            expect.assertions(1);

            request.headers = { "x-forwarded-host": "example" };

            expect(getBaseUrl(request)).toBe("//example");
        });

        it("should construct absolute base URL with forwarded protocol and host", () => {
            expect.assertions(1);

            request.headers = { ...request.headers, "x-forwarded-proto": "http" };

            expect(getBaseUrl(request)).toBe("http://example");
        });

        it("should extract base URL from forwarded header", () => {
            expect.assertions(1);

            request.headers = { ...request.headers, forwarded: "by=by;for=for;host=example;proto=https" };

            expect(getBaseUrl(request)).toBe("https://example");
        });

        it("should read quoted, padded and mixed-case Forwarded values", () => {
            expect.assertions(2);

            expect(getBaseUrl({ headers: { forwarded: 'for=1.2.3.4; Host="example.com:8080"; PROTO=HTTPS' } } as IncomingMessage)).toBe(
                "https://example.com:8080",
            );
            // The first element is the one closest to the client.
            expect(getBaseUrl({ headers: { forwarded: 'host="a.example";proto=https, host=b.example;proto=http' } } as IncomingMessage)).toBe(
                "https://a.example",
            );
        });

        it("should handle multiple forwarded header entries", () => {
            expect.assertions(1);

            request.headers = { ...request.headers, forwarded: "by=by;for=for;host=example;proto=https,by=by;for=for;host=example;proto=https" };

            expect(getBaseUrl(request)).toBe("https://example");
        });

        it("should append single header value to response", () => {
            expect.assertions(1);

            appendHeader(response, "head", "value");

            expect(response.getHeaders()).toStrictEqual({ head: "value" });
        });

        it("should append multiple header values to existing header", () => {
            expect.assertions(1);

            appendHeader(response, "head", "value1");
            appendHeader(response, "head", "value2");

            expect(response.getHeaders()).toStrictEqual({ head: "value,value1,value2" });
        });

        it("should set headers and expose them in access-control-expose-headers", () => {
            expect.assertions(1);

            setHeaders(response, { head: "value" });

            expect(response.getHeaders()).toStrictEqual({ "access-control-expose-headers": "head", head: "value" });
        });

        it("should set multiple header values and expose them correctly", () => {
            expect.assertions(1);

            setHeaders(response, { head: ["value1", "value2"] });

            expect(response.getHeaders()).toStrictEqual({ "access-control-expose-headers": "head,head", head: ["value1", "value2"] });
        });

        it("should extract host from request headers", () => {
            expect.assertions(1);

            expect(extractHost(request)).toBe("example");
        });

        it("should extract protocol from request headers", () => {
            expect.assertions(1);

            expect(extractProto(request)).toBe("http");
        });

        it("should return empty metadata for non-JSON content type", async () => {
            expect.assertions(1);

            request.headers = { "content-type": "application/text" };

            const metadata = await getMetadata(request);

            expect(metadata).toStrictEqual({});
        });

        it("should parse metadata from JSON request body", async () => {
            expect.assertions(1);

            request.headers = { "content-type": "application/json", "transfer-encoding": "chunked" };
            request.body = {
                encoding: "",
                md5: "",
                mime,
                name: "",
                sha1: "",
                sha256: "",
                sha512: "",
                size: 0,
            };
            const metadata = await getMetadata(request);

            expect(metadata).toStrictEqual({
                encoding: "",
                md5: "",
                mime,
                name: "",
                sha1: "",
                sha256: "",
                sha512: "",
                size: 0,
            });
        });

        it.each([
            ["/1/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],
        ])("should extract ID from Express-style request URL: %p -> %p", (url, name) => {
            expect.assertions(1);

            expect(getIdFromRequest(createRequest({ url }))).toBe(name);
        });

        it.each([
            ["/files/1/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/1/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/3/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            // A dashed mount path must not win over a nanoid id.
            ["/files-deferred-expired/BXy9pkoIth6JGq4y0LlPQ", "BXy9pkoIth6JGq4y0LlPQ"],
            ["/files/BXy9pkoIth6JGq4y0LlPQ/metadata", "BXy9pkoIth6JGq4y0LlPQ"],
            ["/3", "3"],
        ])("should extract ID from Node.js-style request URL: %p -> %p", (url, id) => {
            expect.assertions(1);

            expect(getIdFromRequest({ url } as IncomingMessage)).toBe(id);
        });

        it.each([["/"], ["/files"], ["/files/files"]])("should throw error for invalid Express-style URLs: %p", (url) => {
            expect.assertions(1);

            expect(() => getIdFromRequest(createRequest({ url }))).toThrow("Invalid request URL");
        });

        it.each([
            ["http://localhost/files/V1StGXR8_Z5jdHi6B-myT", "V1StGXR8_Z5jdHi6B-myT"],
            ["http://localhost/t/1111-2222-3333/files/V1StGXR8_Z5jdHi6B-myT", "V1StGXR8_Z5jdHi6B-myT"],
            ["http://localhost/V1StGXR8_Z5jdHi6B-myT", "V1StGXR8_Z5jdHi6B-myT"],
            ["http://localhost/files/asset01", "asset01"],
            ["http://localhost/files/3", "3"],
            ["http://localhost/files/archive.tar.gz", "archive.tar.gz"],
        ])("should extract the last path segment as ID from a fetch URL: %p -> %p", (url, id) => {
            expect.assertions(1);

            expect(getIdFromRequestUrl(url)).toBe(id);
        });

        it.each([
            ["http://localhost/files/391c9157ec481ac6-f72b2d884632d7e6.png", "391c9157ec481ac6-f72b2d884632d7e6"],
            ["http://localhost/files/asset01", "asset01"],
        ])("should strip the extension from a fetch URL id when requested: %p -> %p", (url, id) => {
            expect.assertions(1);

            expect(getIdFromRequestUrl(url, { stripExtension: true })).toBe(id);
        });

        it.each([["http://localhost/"], ["http://localhost/files"], ["http://localhost/files/upload"], ["http://localhost/files/upload.json"]])(
            "should return undefined for fetch URLs without an ID: %p",
            (url) => {
                expect.assertions(1);

                expect(getIdFromRequestUrl(url, { stripExtension: true })).toBeUndefined();
            },
        );

        it.each([["http://localhost/files/..%2F..%2Fetc%2Fpasswd"], ["http://localhost/files/%2Fetc%2Fpasswd"]])(
            "should reject an encoded traversal id in a fetch URL with 400: %p",
            (url) => {
                expect.assertions(1);

                expect(() => getIdFromRequestUrl(url)).toThrow(expect.objectContaining({ statusCode: 400 }));
            },
        );

        it("should return the real path from request URL or originalUrl", () => {
            expect.assertions(2);

            const path = "/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png";

            let testRequest = createRequest({ url: path });
            let realPath = getRealPath(testRequest);

            expect(realPath).toBe("/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png");

            testRequest = createRequest({ originalUrl: path });
            realPath = getRealPath(testRequest);

            expect(realPath).toBe("/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png");
        });

        it("should throw error when real path cannot be determined", () => {
            expect.assertions(3);

            let testRequest = createRequest({ url: "" });

            expect(() => getRealPath(testRequest)).toThrow("Invalid request URL");

            testRequest = createRequest({});

            expect(() => getRealPath(testRequest)).toThrow("Invalid request URL");

            testRequest = createRequest({ originalUrl: "" });

            expect(() => getRealPath(testRequest)).toThrow("Invalid request URL");
        });

        it("should read body and return correct string content", async () => {
            expect.assertions(1);

            const httpRequest = httpCreateRequest({
                body: "Hello world!",
            });

            const body = await readBody(httpRequest);

            expect(body).toBe("Hello world!");
        });

        it("should handle different text encodings when reading body", async () => {
            expect.assertions(3);

            let httpRequest = httpCreateRequest({ body: "Hello world!", encoding: "ascii" });
            let body = await readBody(httpRequest, "ascii");

            expect(body).toBe("Hello world!");

            httpRequest = httpCreateRequest({ body: "Hello world!", encoding: "utf8" });
            body = await readBody(httpRequest, "utf8");

            expect(body).toBe("Hello world!");

            httpRequest = httpCreateRequest({ body: "Hello world!", encoding: "latin1" });
            body = await readBody(httpRequest, "latin1");

            expect(body).toBe("Hello world!");
        });
    });

    it("should read a Web API request body within the limit", async () => {
        expect.assertions(1);

        await expect(readWebRequestText(new Request("http://localhost/", { body: "héllo", method: "POST" }), 6)).resolves.toBe("héllo");
    });

    it("should reject a Web API request body over the limit while streaming, without a Content-Length", async () => {
        expect.assertions(1);

        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                // Endless body: only a streaming cap can stop it
                controller.enqueue(new Uint8Array(1024));
            },
        });
        const request = new Request("http://localhost/", { body, duplex: "half", method: "POST" } as RequestInit);

        await expect(readWebRequestText(request, 4096)).rejects.toThrow(expect.objectContaining({ statusCode: 413 }));
    });

    it("should reject a Web API request whose Content-Length exceeds the limit before reading", async () => {
        expect.assertions(1);

        const request = new Request("http://localhost/", { body: "x".repeat(10), headers: { "content-length": "10" }, method: "POST" });

        await expect(readWebRequestText(request, 5)).rejects.toThrow(expect.objectContaining({ statusCode: 413 }));
    });

    it("should reject when request body exceeds length limit", async () => {
        expect.assertions(2);

        const request = httpCreateRequest({ body: "Hello world!" });

        await expect(readBody(request, "utf8", 5)).rejects.toThrow(expect.objectContaining({ message: "Request body length limit exceeded", statusCode: 413 }));
        // The request is drained, not destroyed, so the caller can still send the 413 response
        expect(request.destroyed).toBe(false);
    });

    it("should cut off a refused body that is still being sent once the drain time is up", async () => {
        expect.assertions(3);

        vi.useFakeTimers();

        try {
            const request = new PassThrough();

            request.write("x".repeat(10));

            await expect(readBody(request as unknown as IncomingMessage, "utf8", 5)).rejects.toThrow(expect.objectContaining({ statusCode: 413 }));

            vi.advanceTimersByTime(MAX_DRAIN_MS - 1);

            expect(request.destroyed).toBe(false);

            vi.advanceTimersByTime(1);

            expect(request.destroyed).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it("should use UTF-8 encoding as default when reading body", async () => {
        expect.assertions(1);

        const request = httpCreateRequest({ body: "Hello world!", encoding: "utf8" });
        const body = await readBody(request);

        expect(body).toBe("Hello world!");
    });
});
