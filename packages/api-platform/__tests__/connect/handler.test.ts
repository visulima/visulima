import type { HttpError } from "http-errors";
import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { onError, onNoMatch } from "../../src/connect/handler";

describe("connect/handler", () => {
    it("should call onNoMatch", async () => {
        const { req, res } = createMocks({
            method: "POST",
        });

        try {
            await onNoMatch(req, res, [
                {
                    keys: false,
                    pattern: /test/,
                    method: "GET",
                    fns: [],
                    isMiddleware: false,
                },
            ]);
        } catch (error: any) {
            expect((error as HttpError).message).toStrictEqual("No route with [POST] method found.");
            expect((error as HttpError).statusCode).toStrictEqual(405);

            // eslint-disable-next-line no-underscore-dangle
            expect(res._getStatusCode()).toStrictEqual(405);
            // eslint-disable-next-line no-underscore-dangle
            expect(res._getHeaders()).toStrictEqual({ allow: "GET" });
        }
    });

    it("should call onError", async () => {
        const { req, res } = createMocks({
            method: "GET",
        });

        await onError([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toStrictEqual(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toStrictEqual('{"type":"https://tools.ietf.org/html/rfc2616#section-10","title":"Bad Request","details":"Bad Request"}');
    });

    it("should call onError with accept", async () => {
        const { req, res } = createMocks({
            method: "GET",
            headers: {
                accept: "application/vnd.api+json",
            },
        });

        await onError([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toStrictEqual(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toStrictEqual('{"errors":[{"code":400,"title":"Bad Request","detail":"Bad Request"}]}');
    });

    it("should call onError with new added error handler", async () => {
        const { req, res } = createMocks({
            method: "GET",
            headers: {
                accept: "application/yaml",
            },
        });

        await onError(
            [
                {
                    regex: /application\/yaml/,
                    handler: (error: any, _, response) => {
                        response.statusCode = (error as HttpError).statusCode;
                        response.end((error as HttpError).message);
                    },
                },
            ],
            false,
        )(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toStrictEqual(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toStrictEqual("Bad Request");
    });
});
