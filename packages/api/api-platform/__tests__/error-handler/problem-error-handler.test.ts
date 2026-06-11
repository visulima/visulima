import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import problemErrorHandler from "../../src/error-handler/problem-error-handler";

describe("jsonapi-error-handler", () => {
    it("should suppress the raw message of a non-exposed error", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        // A generic Error (e.g. an unexpected SQL/file-path leak) must not have
        // its message reflected to the client.
        const error = new Error("connection to db at /var/secret failed");

        await problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"type\":\"https://tools.ietf.org/html/rfc2616#section-10\",\"title\":\"Internal Server Error\",\"details\":\"Internal Server Error\"}");
    });

    it("should expose the message of an opted-in error", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = Object.assign(new Error("safe message"), { expose: true });

        await problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData() as string) as { details: string };

        expect(data.details).toBe("safe message");
    });

    it("should render http-errors", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.Forbidden();

        error.expose = false;

        await problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"type\":\"https://tools.ietf.org/html/rfc2616#section-10\",\"title\":\"Forbidden\",\"details\":\"Forbidden\"}");
    });
});
