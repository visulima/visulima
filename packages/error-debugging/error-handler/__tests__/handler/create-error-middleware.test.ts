import type { IncomingMessage, ServerResponse } from "node:http";

import { createMocks } from "node-mocks-http";
import { describe, expect, it, vi } from "vitest";

import createErrorMiddleware from "../../src/handler/http/create-error-middleware";

describe(createErrorMiddleware, () => {
    it("registers once and handles a negotiated error", async () => {
        expect.assertions(3);

        const middleware = createErrorMiddleware({ showTrace: false });

        const { req, res } = createMocks({
            headers: { accept: "application/json" },
            method: "GET",
        });

        await middleware(new Error("boom"), req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(JSON.parse(res._getData())).toMatchObject({ statusCode: 500 });
    });

    it("delegates to next(error) when the response has already started", async () => {
        expect.assertions(2);

        const middleware = createErrorMiddleware();

        const { req, res } = createMocks({ method: "GET" });

        // Simulate a response that already began streaming.
        Object.defineProperty(res, "headersSent", { configurable: true, value: true });

        const next = vi.fn<(error?: unknown) => void>();
        const error = new Error("late");

        await middleware(error, req, res, next);

        expect(next).toHaveBeenCalledWith(error);
        // The middleware must not write a body once headers are sent.
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("");
    });

    it("forwards onError logging callbacks", async () => {
        expect.assertions(1);

        const onError = vi.fn<(error: Error, request: IncomingMessage, response: ServerResponse) => void | Promise<void>>();
        const middleware = createErrorMiddleware({ onError, showTrace: false });

        const { req, res } = createMocks({
            headers: { accept: "application/json" },
            method: "GET",
        });

        const error = new Error("boom");

        await middleware(error, req, res);

        expect(onError).toHaveBeenCalledWith(error, req, res);
    });
});
