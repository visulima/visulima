import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { jsonErrorHandler } from "../../src/error-handler/json-error-handler";

describe("json-error-handler with http-errors", () => {
    it("renders status, content-type, and body for http-error", async () => {
        expect.assertions(4);

        const { req, res } = createMocks({ method: "GET" });

        await jsonErrorHandler()(new httpErrors.BadRequest() as unknown as Error, req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData()) as { error: string; message: string; statusCode: number };

        expect(data.statusCode).toBe(400);
        expect(data.error).toBe("Bad Request");
    });
});
