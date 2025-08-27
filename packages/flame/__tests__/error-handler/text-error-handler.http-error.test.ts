import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import textErrorHandler from "../../src/error-handler/text-error-handler";

describe("text-error-handler with http-errors", () => {
    it("renders status, content-type, and plain text body for http-error", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({ method: "GET" });

        const error = new httpErrors.BadRequest();
        error.expose = false;
        await textErrorHandler()((error as unknown as Error), req, res);

        expect(String(res.getHeader("content-type"))).toBe("text/plain; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("Bad Request");
    });
});


