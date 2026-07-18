import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import problemErrorHandler from "../../src/error-handler/problem-error-handler";

describe("problem-error-handler", () => {
    it("should render normal error", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new Error("test");

        await problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        expect(String(res.getHeader("content-type"))).toBe("application/problem+json");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"type\":\"about:blank\",\"title\":\"Internal Server Error\",\"status\":500,\"detail\":\"test\"}");
    });

    it("should render http-errors", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.Forbidden();

        error.expose = false;

        await problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403);
        expect(String(res.getHeader("content-type"))).toBe("application/problem+json");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"type\":\"about:blank\",\"title\":\"Forbidden\",\"status\":403,\"detail\":\"Forbidden\"}");
    });

    it("should include the stack as trace when http-error exposes it", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({
            method: "GET",
        });

        // httpErrors.Forbidden() defaults to expose === true for 4xx errors.
        const error = new httpErrors.Forbidden("nope");

        await problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403);

        // eslint-disable-next-line no-underscore-dangle
        const body = JSON.parse(res._getData()) as { detail: string; status: number; title: string; trace: string };

        expect(body.status).toBe(403);
        // The exposed trace is the error's stack string.
        expect(body.trace).toContain("Error: nope");
    });

    it("clamps a duck-typed http-error carrying an out-of-range status to 500", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        // A wrapper error that duck-types as an HttpError but carries status 200
        // must not produce a 200-OK problem response.
        const error = new Error("weird") as Error & { expose: boolean; status: number; statusCode: number };

        error.expose = false;
        error.status = 200;
        error.statusCode = 200;

        await problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);

        // eslint-disable-next-line no-underscore-dangle
        const body = JSON.parse(res._getData()) as { status: number };

        expect(body.status).toBe(500);
    });

    it("should prefer the error's own title and type properties", async () => {
        expect.assertions(4);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.Forbidden("denied");

        error.expose = false;
        (error as httpErrors.HttpError & { title: string; type: string }).title = "Custom Title";
        (error as httpErrors.HttpError & { title: string; type: string }).type = "https://example.com/forbidden";

        await problemErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403);

        // eslint-disable-next-line no-underscore-dangle
        const body = JSON.parse(res._getData()) as { detail: string; title: string; trace?: string; type: string };

        expect(body.title).toBe("Custom Title");
        expect(body.type).toBe("https://example.com/forbidden");
        // expose === false, so no trace must be present.
        expect(body.trace).toBeUndefined();
    });
});
