import type { HttpError } from "http-errors";
import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { onError, onNoMatch } from "../../src/connect/handler";

const TEST_PATTERN = /test/u;
const APPLICATION_YAML_REGEX = /application\/yaml/u;

describe("connect/handler", () => {
    it("should call onNoMatch", async () => {
        expect.assertions(4);

        const { req, res } = createMocks({
            method: "POST",
        });

        /* eslint-disable vitest/no-conditional-expect -- assertions inspect both the thrown error and the response side-effects, which only exist after the rejection path */
        try {
            await onNoMatch(req, res, [
                {
                    fns: [],
                    isMiddleware: false,
                    keys: false,
                    method: "GET",
                    pattern: TEST_PATTERN,
                },
            ]);
        } catch (error) {
            expect((error as HttpError).message).toBe("No route with [POST] method found.");
            expect((error as HttpError).statusCode).toBe(405);

            // eslint-disable-next-line no-underscore-dangle
            expect(res._getStatusCode()).toBe(405);
            // eslint-disable-next-line no-underscore-dangle
            expect(res._getHeaders()).toStrictEqual({ allow: "GET" });
        }
        /* eslint-enable vitest/no-conditional-expect */
    });

    it("should call onError", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        await onError([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"type\":\"https://tools.ietf.org/html/rfc2616#section-10\",\"title\":\"Bad Request\",\"details\":\"Bad Request\"}");
    });

    it("should call onError with accept", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            headers: {
                accept: "application/vnd.api+json",
            },
            method: "GET",
        });

        await onError([], false)(new httpErrors.BadRequest(), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"errors\":[{\"code\":400,\"title\":\"Bad Request\",\"detail\":\"Bad Request\"}]}");
    });

    it("should call onError with new added error handler", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            headers: {
                accept: "application/yaml",
            },
            method: "GET",
        });

        await onError(
            [
                {
                    // eslint-disable-next-line @typescript-eslint/require-await -- the handler signature must satisfy the async ErrorHandler contract even though this stub is synchronous
                    handler: async (error: unknown, _, response) => {
                        response.statusCode = (error as HttpError).statusCode;
                        response.end((error as HttpError).message);
                    },
                    regex: APPLICATION_YAML_REGEX,
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
