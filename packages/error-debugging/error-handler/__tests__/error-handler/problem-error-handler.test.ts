import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import problemErrorHandler from "../../src/error-handler/problem-error-handler";

describe("problem-error-handler", () => {
    it("should render normal error", () => {
        expect.assertions(3);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new Error("test");

        problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        expect(String(res.getHeader("content-type"))).toBe("application/problem+json");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe('{"type":"about:blank","title":"Internal Server Error","status":500,"detail":"test"}');
    });

    it("should render http-errors", () => {
        expect.assertions(3);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.Forbidden();

        error.expose = false;

        problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403);
        expect(String(res.getHeader("content-type"))).toBe("application/problem+json");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe('{"type":"about:blank","title":"Forbidden","status":403,"detail":"Forbidden"}');
    });
});
