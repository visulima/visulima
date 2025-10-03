import type { IncomingMessage } from "node:http";

import httpMocks, { createRequest } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import {
    appendHeader,
    extractHost,
    extractProto,
    getBaseUrl,
    getHeader,
    getIdFromRequest,
    getMetadata,
    getRealPath,
    normalizeHookResponse,
    normalizeOnErrorResponse,
    readBody,
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

        it("getHeader(not exist)", () => {
            expect(getHeader(request, "not exist")).toBe("");
        });

        it("getHeader(single)", () => {
            request.headers = { head: "value" };

            expect(getHeader(request, "head")).toBe("value");
        });

        it("getHeader(multiple)", () => {
            request.headers = { head: ["value1", "value2"] };

            expect(getHeader(request, "head")).toBe("value2");
            expect(getHeader(request, "head", true)).toBe("value1,value2");
        });

        it("getBaseUrl(no-host)", () => {
            expect(getBaseUrl(request)).toBe("");
        });

        it("getBaseUrl(no-proto)", () => {
            request.headers = { "x-forwarded-host": "example" };

            expect(getBaseUrl(request)).toBe("//example");
        });

        it("getBaseUrl(absolute)", () => {
            request.headers = { ...request.headers, "x-forwarded-proto": "http" };

            expect(getBaseUrl(request)).toBe("http://example");
        });

        it("getBaseUrl(forwarded)", () => {
            request.headers = { ...request.headers, forwarded: "by=by;for=for;host=example;proto=https" };

            expect(getBaseUrl(request)).toBe("https://example");
        });

        it("getBaseUrl(forwarded-multiple)", () => {
            request.headers = { ...request.headers, forwarded: "by=by;for=for;host=example;proto=https,by=by;for=for;host=example;proto=https" };

            expect(getBaseUrl(request)).toBe("https://example");
        });

        it("appendHeader", () => {
            appendHeader(response, "head", "value");

            expect(response.getHeaders()).toEqual({ head: "value" });
        });

        it("appendHeader(multiple)", () => {
            appendHeader(response, "head", "value1");
            appendHeader(response, "head", "value2");

            expect(response.getHeaders()).toEqual({ head: "value,value1,value2" });
        });

        it("setHeaders", () => {
            setHeaders(response, { head: "value" });

            expect(response.getHeaders()).toEqual({ "access-control-expose-headers": "head", head: "value" });
        });

        it("setHeaders(multiple)", () => {
            setHeaders(response, { head: ["value1", "value2"] });

            expect(response.getHeaders()).toEqual({ "access-control-expose-headers": "head,head", head: ["value1", "value2"] });
        });

        it("extractHost", () => {
            expect(extractHost(request)).toBe("example");
        });

        it("extractProto", () => {
            expect(extractProto(request)).toBe("http");
        });

        it("normalizeHookResponse", async () => {
            const callback = normalizeHookResponse(async () => {
                return { body: "body" };
            });
            const result = await callback(request);

            expect(result).toEqual({ body: "body" });
        });

        it("normalizeHookResponse(throw)", async () => {
            const callback = normalizeHookResponse(async () => {
                throw new Error("error");
            });

            await expect(callback(request)).rejects.toBeInstanceOf(Error);
        });

        it("normalizeOnErrorResponse", async () => {
            const callback = normalizeOnErrorResponse(async () => {
                return { body: "body" };
            });

            await expect(callback(response)).resolves.toEqual({ body: "body" });

            const function2 = normalizeOnErrorResponse(() => {
                return { body: "body" };
            });

            expect(function2(response)).toEqual({ body: "body" });
        });

        it("normalizeOnErrorResponse(throw)", async () => {
            const callback = normalizeOnErrorResponse(async () => {
                throw new Error("error");
            });

            await expect(callback(response)).rejects.toBeInstanceOf(Error);

            const function2 = normalizeOnErrorResponse(() => {
                throw new Error("error");
            });

            expect(() => function2(response)).toThrow("error");
        });

        it("getMetadata with content-type json", async () => {
            request.headers = { "content-type": "application/text" };

            const metadata = await getMetadata(request);

            expect(metadata).toEqual({});
        });

        it("getMetadata with content-type text and body", async () => {
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

            expect(metadata).toEqual({
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
            // eslint-disable-next-line radar/no-duplicate-string
            ["/1/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],
            // eslint-disable-next-line no-secrets/no-secrets,radar/no-duplicate-string
            ["/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],
        ])("express: getIdFromRequest(%p) === %p", (url, name) => {
            expect(getIdFromRequest(createRequest({ url }))).toBe(name);
        });

        it.each([
            ["/files/1/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/1/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],

            ["/3/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],
            // eslint-disable-next-line no-secrets/no-secrets
            ["/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png", "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3"],
        ])("nodejs: getIdFromRequest(%p) === %p", (url, id) => {
            expect(getIdFromRequest({ url } as IncomingMessage)).toBe(id);
        });

        it.each([["/"], ["/files"], ["/3"], ["/files/files"]])("express: getIdFromRequest(%p) === %p", (url) => {
            expect(() => getIdFromRequest(createRequest({ url }))).toThrow();
        });

        it("should return the real path", () => {
            // eslint-disable-next-line no-secrets/no-secrets
            const path = "/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png";

            let testRequest = createRequest({ url: path });
            let realPath = getRealPath(testRequest);

            // eslint-disable-next-line no-secrets/no-secrets
            expect(realPath).toBe("/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png");

            testRequest = createRequest({ originalUrl: path });
            realPath = getRealPath(testRequest);

            // eslint-disable-next-line no-secrets/no-secrets
            expect(realPath).toBe("/files/391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3.png");
        });

        it("should throw a error if real path cant be found", () => {
            let testRequest = createRequest({ url: "" });

            expect(() => getRealPath(testRequest)).toThrow();

            testRequest = createRequest({});

            expect(() => getRealPath(testRequest)).toThrow();

            testRequest = createRequest({ originalUrl: "" });

            expect(() => getRealPath(testRequest)).toThrow();
        });

        it("readBody returns correct body string", async () => {
            const httpRequest = httpCreateRequest({
                // eslint-disable-next-line radar/no-duplicate-string
                body: "Hello world!",
            });

            const body = await readBody(httpRequest);

            expect(body).toBe("Hello world!");
        });

        it("readBody handles different encodings", async () => {
            let httpRequest = httpCreateRequest({ body: "Hello world!", encoding: "ascii" });
            let body = await readBody(httpRequest, "ascii");

            expect(body).toBe("Hello world!");

            httpRequest = httpCreateRequest({ body: "Hello world!", encoding: "utf8" });
            body = await readBody(httpRequest, "utf8");

            expect(body).toBe("Hello world!");

            httpRequest = httpCreateRequest({ body: "Hello world!", encoding: "latin1" });
            body = await readBody(httpRequest, "latin1");

            expect(body).toBe("Hello world!");

            httpRequest = httpCreateRequest({ body: "Hello world!", encoding: "hex" });
            body = await readBody(httpRequest, "hex");

            expect(body).toBe("Hello world!");
        });
    });

    it("readBody handles request body length limit", async () => {
        const request = httpCreateRequest({ body: "Hello world!" });

        await expect(readBody(request, "utf8", 5)).rejects.toThrow("Request body length limit exceeded");
    });

    it("readBody handles default encoding of utf8", async () => {
        const request = httpCreateRequest({ body: "Hello world!", encoding: "utf8" });
        const body = await readBody(request);

        expect(body).toBe("Hello world!");
    });
});
