import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { textErrorHandler } from "../../src/error-handler/text-error-handler";

describe("text-error-handler with normal Error", () => {
    it("renders default 500 plain text response for normal Error", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({ method: "GET" });

        await textErrorHandler()(new Error("boom"), req, res);

        expect(String(res.getHeader("content-type"))).toBe("text/plain; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("boom");
    });
});
