import type { IncomingMessage } from "node:http";

import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { jsonpErrorHandler } from "../../src/error-handler/jsonp-error-handler";

describe("jsonp-error-handler with normal Error", () => {
    it("renders default 500 JSONP response for normal Error", async () => {
        expect.assertions(4);

        const { req, res } = createMocks({ method: "GET", url: "/?callback=myCb" });

        await jsonpErrorHandler()(new Error("boom"), req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/javascript; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);

        // eslint-disable-next-line no-underscore-dangle
        const body = res._getData();

        expect(body.startsWith("myCb(")).toBe(true);

        const json = body.slice("myCb(".length, -2);
        const parsed = JSON.parse(json) as { statusCode: number };

        expect(parsed.statusCode).toBe(500);
    });

    it("defaults the callback name when request.url is missing", async () => {
        expect.assertions(2);

        const { res } = createMocks({ method: "GET" });

        // A request without a url exercises the `request.url ?? "http://localhost"` fallback.
        const request = { headers: {}, method: "GET", url: undefined } as unknown as IncomingMessage;

        await jsonpErrorHandler()(new Error("boom"), request, res);

        // eslint-disable-next-line no-underscore-dangle
        const body = res._getData() as string;

        // No callback query param -> defaults to "callback".
        expect(body.startsWith("callback(")).toBe(true);
        expect(body.endsWith(");")).toBe(true);
    });

    it("falls back to the reason phrase when the error message is empty", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET", url: "/?callback=cb" });

        // eslint-disable-next-line unicorn/error-message -- intentionally empty to exercise the reason-phrase fallback
        await jsonpErrorHandler()(new Error(""), req, res);

        // eslint-disable-next-line no-underscore-dangle
        const body = res._getData() as string;
        const parsed = JSON.parse(body.slice("cb(".length, -2)) as { message: string };

        // Empty message -> message falls back to the reason phrase.
        expect(parsed.message).toBe("Internal Server Error");
    });
});
