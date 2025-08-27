import type { HttpError } from "http-errors";
import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import createNegotiatedErrorHandler from "../../src/error-handler/create-negotiated-error-handler";

describe("flame createNegotiatedErrorHandler negotiator", () => {
    it("falls back to Problem JSON if no Accept provided", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe('{"type":"https://tools.ietf.org/html/rfc2616#section-10","title":"Bad Request","details":"Bad Request"}');
    });

    it("uses JSON:API when Accept is application/vnd.api+json", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "application/vnd.api+json" },
        });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe('{"errors":[{"code":400,"title":"Bad Request","detail":"Bad Request"}]}');
    });

    it("uses Problem JSON when Accept is application/problem+json", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "application/problem+json" },
        });

        await createNegotiatedErrorHandler([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe('{"type":"https://tools.ietf.org/html/rfc2616#section-10","title":"Bad Request","details":"Bad Request"}');
    });

    it("uses HTML when Accept is text/html and default HTML handler provided", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "text/html" },
        });

        const defaultHtml = (error: any, _req: any, res: any) => {
            res.statusCode = (error as HttpError).statusCode ?? 500;
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end("<!DOCTYPE html><html><head><title>Test</title></head><body>ok</body></html>");
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
            method: "GET",
            headers: { accept: "application/yaml" },
        });

        await createNegotiatedErrorHandler(
            [
                {
                    handler: (error: any, _, response) => {
                        response.statusCode = (error as HttpError).statusCode ?? 400;
                        response.end((error as HttpError).message);
                    },
                    regex: /application\/yaml/u,
                },
            ],
            false,
        )(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("Bad Request");
    });
});
