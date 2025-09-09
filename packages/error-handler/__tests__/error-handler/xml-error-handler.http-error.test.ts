import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { xmlErrorHandler } from "../../src/error-handler/xml-error-handler";

describe("xml-error-handler with http-errors", () => {
    it("renders status, content-type, and XML body for http-error", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({ method: "GET" });

        await xmlErrorHandler()(new httpErrors.BadRequest() as unknown as Error, req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/xml; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("<error>");
    });
});
