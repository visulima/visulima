import type { IncomingMessage } from "node:http";
import { createRequest, createResponse } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import {
    jsonResponse, parseBody, parseQuery, toHeaderCase,
} from "../src/utils";

describe("utils", () => {
    describe("toHeaderCase", () => {
        it("should convert a string to header case", () => {
            // eslint-disable-next-line sonarjs/no-duplicate-string
            expect(toHeaderCase("Hello World")).toEqual("Hello-World");
            expect(toHeaderCase("hello world")).toEqual("Hello-World");
            expect(toHeaderCase("Hello, World!")).toEqual("Hello-World");
            expect(toHeaderCase("Hello_World")).toEqual("Hello-World");
        });

        it("should handle empty strings", () => {
            expect(toHeaderCase("")).toEqual("");
        });

        it("should handle single-word strings", () => {
            expect(toHeaderCase("hello")).toEqual("Hello");
            expect(toHeaderCase("HELLO")).toEqual("Hello");
        });

        it("should handle strings with multiple spaces", () => {
            expect(toHeaderCase("Hello   World")).toEqual("Hello-World");
            expect(toHeaderCase("Hello  \t  World")).toEqual("Hello-World");
        });
    });

    describe("jsonResponse", () => {
        it("sets statusCode of response to specified status value", async () => {
            const response = createResponse();
            const status = 200;
            const data = { message: "Success" };

            jsonResponse(response, status, data);

            expect(response.statusCode).toEqual(status);
        });

        it("sets Content-Type header of response to application/json", async () => {
            const response = createResponse();
            const status = 200;
            const data = { message: "Success" };

            jsonResponse(response, status, data);

            expect(response.getHeaders()).toEqual({ "content-type": "application/json" });
        });

        it("calls end method of response with stringified data when data is provided", async () => {
            const response = createResponse();
            const status = 200;
            const data = { message: "Success" };

            jsonResponse(response, status, data);

            // eslint-disable-next-line no-underscore-dangle
            expect(response._getData()).toEqual(JSON.stringify(data));
        });

        it("calls end method of response with empty string when data is not provided", async () => {
            const response = createResponse();
            const status = 200;

            jsonResponse(response, status);

            // eslint-disable-next-line no-underscore-dangle
            expect(response._getData()).toEqual("");
        });
    });

    describe("parseBody", () => {
        it("returns request.body when it is provided", async () => {
            const request = createRequest({ body: { message: "Hello" } });
            const expected = { message: "Hello" };
            const actual = await parseBody(request);

            expect(actual).toEqual(expected);
        });
    });

    it("returns object parsed from request body when request.body is not provided", async () => {
        const request = {
            body: null,
            * [Symbol.asyncIterator]() {
                yield Buffer.from(JSON.stringify({ message: "Hello" }));
            },
        };

        const expected = { message: "Hello" };
        const actual = await parseBody(request as unknown as IncomingMessage);

        expect(actual).toEqual(expected);
    });

    it("returns null when request body is an empty string", async () => {
        const request = {
            body: null,
            * [Symbol.asyncIterator]() {
                yield Buffer.from("");
            },
        };
        const expected = null;
        const actual = await parseBody(request as unknown as IncomingMessage);

        expect(actual).toEqual(expected);
    });

    it("throws error when request body is invalid JSON", async () => {
        const request = {
            body: null,
            * [Symbol.asyncIterator]() {
                yield Buffer.from("invalid JSON");
            },
        };

        await expect(parseBody(request as unknown as IncomingMessage)).rejects.toThrow();
    });

    describe("parseQuery", () => {
        it("returns request.query when it is provided", async () => {
            const request = { query: { message: "Hello" } };
            const expected = { message: "Hello" };
            const actual = parseQuery(request as unknown as IncomingMessage);

            expect(actual).toEqual(expected);
        });

        it("returns query string object parsed from request.url when request.query is not provided", async () => {
            const request = { url: "http://example.com?message=Hello", query: null };
            const expected = { message: "Hello" };
            const actual = parseQuery(request as unknown as IncomingMessage);

            expect(actual).toEqual(expected);
        });

        it("returns empty object when request.url is not provided and request.query is not provided", async () => {
            const request = { url: null, query: null };
            const expected = {};
            const actual = parseQuery(request as unknown as IncomingMessage);

            expect(actual).toEqual(expected);
        });
    });
});
