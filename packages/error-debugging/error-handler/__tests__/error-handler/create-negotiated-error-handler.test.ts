import type { IncomingMessage, ServerResponse } from "node:http";

import type { HttpError } from "http-errors";
import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import createNegotiatedErrorHandler from "../../src/error-handler/create-negotiated-error-handler";

const YAML_REGEX = /application\/yaml/u;
const EMPTY_REGEX = /^$/u;

describe("createNegotiatedErrorHandler negotiator", () => {
    it("falls back to Problem JSON if no Accept provided", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"type\":\"about:blank\",\"title\":\"Bad Request\",\"status\":400,\"detail\":\"Bad Request\"}");
    });

    it("uses JSON:API when Accept is application/vnd.api+json", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            headers: { accept: "application/vnd.api+json" },
            method: "GET",
        });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"errors\":[{\"code\":400,\"title\":\"Bad Request\",\"detail\":\"Bad Request\"}]}");
    });

    it("uses Problem JSON when Accept is application/problem+json", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            headers: { accept: "application/problem+json" },
            method: "GET",
        });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"type\":\"about:blank\",\"title\":\"Bad Request\",\"status\":400,\"detail\":\"Bad Request\"}");
    });

    it("uses HTML when Accept is text/html and default HTML handler provided", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            headers: { accept: "text/html" },
            method: "GET",
        });

        const defaultHtml = (error: Error, _request: IncomingMessage, response: ServerResponse) => {
            response.statusCode = (error as HttpError).statusCode;
            response.setHeader("content-type", "text/html; charset=utf-8");
            response.end("<!DOCTYPE html><html><head><title>Test</title></head><body>ok</body></html>");
        };

        await createNegotiatedErrorHandler([], false, defaultHtml)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("<!DOCTYPE html>");
    });

    it("can be overridden by custom regex handler", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            headers: { accept: "application/yaml" },
            method: "GET",
        });

        await createNegotiatedErrorHandler(
            [
                {
                    handler: (error: Error, _, response) => {
                        response.statusCode = (error as HttpError).statusCode;
                        response.end((error as HttpError).message);
                    },
                    regex: YAML_REGEX,
                },
            ],
            false,
        )(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("Bad Request");
    });

    it("skips a regex handler whose pattern does not match the Accept header", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            headers: { accept: "application/json" },
            method: "GET",
        });

        let overrideCalled = false;

        await createNegotiatedErrorHandler(
            [
                {
                    handler: (_error, _, response) => {
                        overrideCalled = true;
                        response.end("should not run");
                    },
                    regex: YAML_REGEX, // Does not match "application/json".
                },
            ],
            false,
        )(new httpErrors.BadRequest(), req, res);

        // The negotiated JSON handler runs; the non-matching regex override is skipped.
        expect(overrideCalled).toBe(false);
        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");
    });

    it("treats a missing Accept header as an empty string when matching regex overrides", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await createNegotiatedErrorHandler(
            [
                {
                    handler: (error: Error, _, response) => {
                        response.statusCode = (error as HttpError).statusCode;
                        response.end("matched-empty");
                    },
                    regex: EMPTY_REGEX, // Matches the "" fallback for a missing Accept header.
                },
            ],
            false,
        )(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("matched-empty");
    });

    it("joins an array-valued Accept header before regex matching", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET" });

        // Simulate Node delivering a multi-value Accept header as an array.
        (req.headers as Record<string, unknown>).accept = ["application/json", "application/yaml"];

        await createNegotiatedErrorHandler(
            [
                {
                    handler: (_error, _, response) => {
                        response.end("array-joined");
                    },
                    regex: YAML_REGEX, // Matches after the array is joined to a string.
                },
            ],
            false,
        )(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("array-joined");
    });

    it("uses Text when Accept is text/plain", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({
            headers: { accept: "text/plain" },
            method: "GET",
        });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        expect(String(res.getHeader("content-type"))).toBe("text/plain; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("Bad Request");
    });

    it("uses JSON when Accept is application/json", async () => {
        expect.assertions(4);

        const { req, res } = createMocks({
            headers: { accept: "application/json" },
            method: "GET",
        });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData()) as { error: string; statusCode: number };

        expect(data.statusCode).toBe(400);
        expect(data.error).toBe("Bad Request");
    });

    it("uses JSONP when Accept is application/javascript", async () => {
        expect.assertions(4);

        const { req, res } = createMocks({
            headers: { accept: "application/javascript" },
            method: "GET",
            url: "/?callback=myCb",
        });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        expect(String(res.getHeader("content-type"))).toBe("application/javascript; charset=utf-8");

        // eslint-disable-next-line no-underscore-dangle
        const body = res._getData();

        expect(body.startsWith("/**/ typeof myCb === 'function' && myCb(")).toBe(true);

        const json = /&&\s*[\w$.]+\((.*)\);$/su.exec(body)?.[1] ?? "";
        const parsed = JSON.parse(json) as { statusCode: number };

        expect(parsed.statusCode).toBe(400);
    });

    it("uses XML when Accept is application/xml", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({
            headers: { accept: "application/xml" },
            method: "GET",
        });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        expect(String(res.getHeader("content-type"))).toBe("application/xml; charset=utf-8");

        // eslint-disable-next-line no-underscore-dangle
        const xml = res._getData();

        expect(xml).toContain("<error>");
    });
});
