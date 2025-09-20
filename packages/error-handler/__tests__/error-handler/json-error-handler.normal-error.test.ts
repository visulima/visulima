import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { jsonErrorHandler } from "../../src/error-handler/json-error-handler";

describe("json-error-handler with normal Error", () => {
    it("renders default 500 response for normal Error", async () => {
        expect.assertions(4);

        const { req, res } = createMocks({ method: "GET" });

        await jsonErrorHandler()(new Error("boom"), req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData()) as { error: string; message: string; statusCode: number };

        expect(data.statusCode).toBe(500);
        expect(data.error).toBe("Internal Server Error");
    });
});
