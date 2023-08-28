import type { IncomingMessage } from "node:http";
import { createRequest, createResponse } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { jsonResponse, parseBody, parseQuery, toHeaderCase } from "../src/utils";

describe("utils", () => {
    describe("toHeaderCase", () => {
        it("should convert a string to header case", () => {
            expect(toHeaderCase("Hello World")).toBe("Hello-World");
            expect(toHeaderCase("hello world")).toBe("Hello-World");
            expect(toHeaderCase("Hello, World!")).toBe("Hello-World");
            expect(toHeaderCase("Hello_World")).toBe("Hello-World");
        });

        it("should handle empty strings", () => {
            expect(toHeaderCase("")).toBe("");
        });

        it("should handle single-word strings", () => {
            expect(toHeaderCase("hello")).toBe("Hello");
            expect(toHeaderCase("HELLO")).toBe("Hello");
        });

        it("should handle strings with multiple spaces", () => {
            expect(toHeaderCase("Hello   World")).toBe("Hello-World");
            expect(toHeaderCase("Hello  \t  World")).toBe("Hello-World");
        });
    });

    describe("jsonResponse", () => {
        it("sets statusCode of response to specified status value", async () => {
            const response = createResponse();
            const status = 200;
            const data = { message: "Success" };

            jsonResponse(response, status, data);

            expect(response.statusCode).toStrictEqual(status);
        });

        it("sets Content-Type header of response to application/json", async () => {
            const response = createResponse();
            const status = 200;
            const data = { message: "Success" };

            jsonResponse(response, status, data);

            expect(response.getHeaders()).toStrictEqual({ "content-type": "application/json" });
        });

        it("calls end method of response with stringified data when data is provided", async () => {
            const response = createResponse();
            const status = 200;
            const data = { message: "Success" };

            jsonResponse(response, status, data);

            // eslint-disable-next-line no-underscore-dangle
            expect(response._getData()).toStrictEqual(JSON.stringify(data));
        });

        it("calls end method of response with empty string when data is not provided", async () => {
            const response = createResponse();
            const status = 200;

            jsonResponse(response, status);

            // eslint-disable-next-line no-underscore-dangle
            expect(response._getData()).toBe("");
        });
    });

    describe("parseBody", () => {
        it("returns request.body when it is provided", async () => {
            const request = createRequest({ body: { message: "Hello" } });
            const expected = { message: "Hello" };
            const actual = await parseBody(request);

            expect(actual).toStrictEqual(expected);
        });
    });

    it("returns object parsed from request body when request.body is not provided", async () => {
        const request = {
            // prettier-ignore
            * [Symbol.asyncIterator]() {
                yield Buffer.from(JSON.stringify({ message: "Hello" }));
            },
            body: null,
        };

        const expected = { message: "Hello" };
        const actual = await parseBody(request as unknown as IncomingMessage);

        expect(actual).toStrictEqual(expected);
    });

    it("returns null when request body is an empty string", async () => {
        const request = {
            // prettier-ignore
            * [Symbol.asyncIterator]() {
                yield Buffer.from("");
            },
            body: null,
        };
        const expected = null;
        const actual = await parseBody(request as unknown as IncomingMessage);

        expect(actual).toStrictEqual(expected);
    });

    it("throws error when request body is invalid JSON", async () => {
        const request = {
            // prettier-ignore
            * [Symbol.asyncIterator]() {
                yield Buffer.from("invalid JSON");
            },
            body: null,
        };

        let errorMessage = "Unexpected token i in JSON at position 0";

        if (process.version.includes("v19") || process.version.includes("v20")) {
            errorMessage = "Unexpected token 'i', \"invalid JSON\" is not valid JSON";
        }

        await expect(parseBody(request as unknown as IncomingMessage)).rejects.toThrow(errorMessage);
    });

    describe("parseQuery", () => {
        it("returns request.query when it is provided", async () => {
            const request = { headers: { host: "example.com" }, query: { message: "Hello" } };
            const expected = { message: "Hello" };
            const actual = parseQuery(request as unknown as IncomingMessage);

            expect(actual).toStrictEqual(expected);
        });

        it("returns query string object parsed from request.url when request.query is not provided", async () => {
            const request = { headers: { host: "example.com/" }, query: null, url: "/?message=Hello" };
            const expected = { message: "Hello" };
            const actual = parseQuery(request as unknown as IncomingMessage);

            // eslint-disable-next-line vitest/prefer-strict-equal
            expect(actual).toEqual(expected);
        });

        it("returns empty object when request.url is not provided and request.query is not provided", async () => {
            const request = { headers: { host: "example.com" }, query: null, url: null };
            const expected = {};
            const actual = parseQuery(request as unknown as IncomingMessage);

            // eslint-disable-next-line vitest/prefer-strict-equal
            expect(actual).toEqual(expected);
        });
    });
});
