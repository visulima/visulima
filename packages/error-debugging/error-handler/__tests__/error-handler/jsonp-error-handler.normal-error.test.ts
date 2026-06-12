import type { IncomingMessage } from "node:http";

import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { jsonpErrorHandler } from "../../src/error-handler/jsonp-error-handler";

const JSONP_BODY_REGEX = /&&\s*[\w$.]+\((.*)\);$/su;

// Extract the JSON argument from the hardened JSONP envelope
// (`/**/ typeof cb === 'function' && cb({...});`).
const parseJsonp = (body: string): Record<string, unknown> => {
    const match = JSONP_BODY_REGEX.exec(body);

    if (!match) {
        throw new Error(`Unexpected JSONP body: ${body}`);
    }

    return JSON.parse(match[1] as string) as Record<string, unknown>;
};

describe("jsonp-error-handler with normal Error", () => {
    it("renders default 500 JSONP response for normal Error", async () => {
        expect.assertions(5);

        const { req, res } = createMocks({ method: "GET", url: "/?callback=myCb" });

        await jsonpErrorHandler()(new Error("boom"), req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/javascript; charset=utf-8");
        // The hardened response disables content sniffing.
        expect(String(res.getHeader("x-content-type-options"))).toBe("nosniff");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);

        // eslint-disable-next-line no-underscore-dangle
        const body = res._getData() as string;

        // The body is wrapped in the `/**/` prologue and a typeof guard.
        expect(body.startsWith("/**/ typeof myCb === 'function' && myCb(")).toBe(true);

        const parsed = parseJsonp(body) as { statusCode: number };

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
        expect(body.startsWith("/**/ typeof callback === 'function' && callback(")).toBe(true);
        expect(body.endsWith(");")).toBe(true);
    });

    it("rejects an unsafe callback name and falls back to the default", async () => {
        expect.assertions(2);

        // A request-controlled callback carrying executable JS / non-identifier
        // characters must never be echoed into the response body.
        const { req, res } = createMocks({ method: "GET", url: "/?callback=alert(1)//" });

        await jsonpErrorHandler()(new Error("boom"), req, res);

        // eslint-disable-next-line no-underscore-dangle
        const body = res._getData() as string;

        // The malicious callback is dropped in favour of the safe default.
        expect(body.startsWith("/**/ typeof callback === 'function' && callback(")).toBe(true);
        expect(body).not.toContain("alert(1)");
    });

    it("rejects an over-long callback name and falls back to the default", async () => {
        expect.assertions(1);

        const longName = "a".repeat(65);
        const { req, res } = createMocks({ method: "GET", url: `/?callback=${longName}` });

        await jsonpErrorHandler()(new Error("boom"), req, res);

        // eslint-disable-next-line no-underscore-dangle
        const body = res._getData() as string;

        // Names longer than 64 chars are rejected to bound the response surface.
        expect(body.startsWith("/**/ typeof callback === 'function' && callback(")).toBe(true);
    });

    it("falls back to the reason phrase when the error message is empty", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET", url: "/?callback=cb" });

        // eslint-disable-next-line unicorn/error-message -- intentionally empty to exercise the reason-phrase fallback
        await jsonpErrorHandler()(new Error(""), req, res);

        // eslint-disable-next-line no-underscore-dangle
        const body = res._getData() as string;
        const parsed = parseJsonp(body) as { message: string };

        // Empty message -> message falls back to the reason phrase.
        expect(parsed.message).toBe("Internal Server Error");
    });
});
