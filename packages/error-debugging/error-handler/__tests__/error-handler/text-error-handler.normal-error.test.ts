import httpErrors from "http-errors";
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

    it("falls back to the reason phrase when the error message is empty", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET" });

        // eslint-disable-next-line unicorn/error-message -- intentionally empty to exercise the reason-phrase fallback
        await textErrorHandler()(new Error(""), req, res);

        // Empty message -> message falls back to the reason phrase.
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("Internal Server Error");
    });

    it("appends the stack when the error exposes it", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        // httpErrors.Forbidden() defaults to expose === true for 4xx errors.
        const error = new httpErrors.Forbidden("nope");

        await textErrorHandler()(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const data = res._getData() as string;

        expect(data.startsWith("nope\n\n")).toBe(true);
        expect(data).toContain("Error: nope");
    });
});
