import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import problemErrorHandler from "../../src/error-handler/problem-error-handler";

describe("problem-error-handler", () => {
    it("should render normal error", () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new Error("test");

        problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe('{"type":"https://tools.ietf.org/html/rfc2616#section-10","title":"Internal Server Error","details":"test"}');
    });

    it("should render http-errors", () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.Forbidden();

        error.expose = false;

        problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe('{"type":"https://tools.ietf.org/html/rfc2616#section-10","title":"Forbidden","details":"Forbidden"}');
    });
});


