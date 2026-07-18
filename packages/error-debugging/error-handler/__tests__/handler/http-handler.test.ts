import type { HttpError } from "http-errors";
import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import fetchHandler from "../../src/handler/http/fetch-handler";
import httpHandler from "../../src/handler/http/node-handler";

const YAML_REGEX = /application\/yaml/u;

describe("httpHandler handler", () => {
    it("returns HTML by default when no Accept header is provided", async () => {
        expect.assertions(3);

        const error = new httpErrors.BadRequest();
        const handler = httpHandler(error);

        const { req, res } = createMocks({ method: "GET" });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        expect(String(res.getHeader("content-type"))).toBe("text/html; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("<!DOCTYPE html>");
    });

    it("renders HTML when Accept is text/html", async () => {
        expect.assertions(3);

        const error = new httpErrors.BadRequest();
        const handler = httpHandler(error);

        const { req, res } = createMocks({
            headers: { accept: "text/html" },
            method: "GET",
        });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        expect(String(res.getHeader("content-type"))).toBe("text/html; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("<!DOCTYPE html>");
    });

    it("returns Problem JSON when Accept is application/problem+json (showTrace default true)", async () => {
        expect.assertions(4);

        const error = new Error("Exploded");
        const handler = httpHandler(error);

        const { req, res } = createMocks({
            headers: { accept: "application/problem+json" },
            method: "GET",
        });

        await handler(req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/problem+json");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData());

        expect(data.detail).toBe("Exploded");
        expect(data.status).toBe(500);

        expectTypeOf(data.trace).toBeString();
    });

    it("omits trace when showTrace is false", async () => {
        expect.assertions(5);

        const error = new Error("No Trace Please");
        const handler = httpHandler(error, { showTrace: false });

        const { req, res } = createMocks({
            headers: { accept: "application/problem+json" },
            method: "GET",
        });

        await handler(req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/problem+json");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData());

        expect(data.detail).toBe("No Trace Please");
        expect(data.status).toBe(500);
        expect(Object.hasOwn(data, "trace")).toBe(false);
    });

    it("omits trace by default in production (NODE_ENV=production, showTrace unset)", async () => {
        expect.assertions(2);

        const previousNodeEnv = process.env.NODE_ENV;

        process.env.NODE_ENV = "production";

        try {
            const error = new Error("Secret stack");
            // No explicit showTrace -> defaults to NODE_ENV !== "production" -> false.
            const handler = httpHandler(error);

            const { req, res } = createMocks({
                headers: { accept: "application/problem+json" },
                method: "GET",
            });

            await handler(req, res);

            // eslint-disable-next-line no-underscore-dangle
            const data = JSON.parse(res._getData());

            expect(data.detail).toBe("Secret stack");
            // The stack trace must not leak to clients in production by default.
            expect(Object.hasOwn(data, "trace")).toBe(false);
        } finally {
            process.env.NODE_ENV = previousNodeEnv;
        }
    });

    it("returns Problem JSON when Accept is application/json", async () => {
        expect.assertions(2);

        const error = new Error("Generic Error");
        const handler = httpHandler(error);

        const { req, res } = createMocks({
            headers: { accept: "application/json" },
            method: "GET",
        });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");
    });

    it("returns JSON:API when Accept is application/vnd.api+json", async () => {
        expect.assertions(4);

        const error = new httpErrors.BadRequest();
        const handler = httpHandler(error);

        const { req, res } = createMocks({
            headers: { accept: "application/vnd.api+json" },
            method: "GET",
        });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        expect(String(res.getHeader("content-type"))).toBe("application/vnd.api+json; charset=utf-8");

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData());

        expect(Array.isArray(data.errors)).toBe(true);
        expect(data.errors[0].code).toBe(400);
    });

    it("can be overridden by extraHandlers (e.g., YAML)", async () => {
        expect.assertions(2);

        const error = new httpErrors.BadRequest();
        const handler = httpHandler(error, {
            extraHandlers: [
                {
                    handler: (error_, _request, response) => {
                        response.statusCode = (error_ as HttpError).statusCode;
                        response.end(error_.message);
                    },
                    regex: YAML_REGEX,
                },
            ],
        });

        const { req, res } = createMocks({
            headers: { accept: "application/yaml" },
            method: "GET",
        });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("Bad Request");
    });

    it("invokes the onError callback before negotiating", async () => {
        expect.assertions(3);

        const error = new httpErrors.BadRequest();

        let captured: Error | undefined;

        const handler = httpHandler(error, {
            onError: (error_) => {
                captured = error_;
            },
        });

        const { req, res } = createMocks({ method: "GET" });

        await handler(req, res);

        expect(captured).toBe(error);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("<!DOCTYPE html>");
    });

    it("still writes the negotiated response when the onError callback throws", async () => {
        expect.assertions(2);

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const error = new httpErrors.BadRequest();

            const handler = httpHandler(error, {
                onError: () => {
                    throw new Error("log transport is down");
                },
            });

            const { req, res } = createMocks({ method: "GET" });

            await handler(req, res);

            // eslint-disable-next-line no-underscore-dangle
            expect(res._getStatusCode()).toBe(400);
            // eslint-disable-next-line no-underscore-dangle
            expect(res._getData()).toContain("<!DOCTYPE html>");
        } finally {
            consoleSpy.mockRestore();
        }
    });

    describe(fetchHandler, () => {
        it("returns HTML by default when no Accept header is provided", async () => {
            expect.assertions(3);

            const error = new httpErrors.BadRequest();
            const handler = fetchHandler(error);

            const request = new Request("http://localhost/test");

            const response = await handler(request);

            expect(response.status).toBe(400);
            expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");

            const body = await response.text();

            expect(body).toContain("<!DOCTYPE html>");
        });

        it("renders HTML when Accept is text/html", async () => {
            expect.assertions(3);

            const error = new httpErrors.BadRequest();
            const handler = fetchHandler(error);

            const request = new Request("http://localhost/test", {
                headers: { accept: "text/html" },
            });

            const response = await handler(request);

            expect(response.status).toBe(400);
            expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");

            const body = await response.text();

            expect(body).toContain("<!DOCTYPE html>");
        });

        it("returns Problem JSON when Accept is application/problem+json (showTrace default true)", async () => {
            expect.assertions(4);

            const error = new Error("Exploded");
            const handler = fetchHandler(error);

            const request = new Request("http://localhost/test", {
                headers: { accept: "application/problem+json" },
            });

            const response = await handler(request);

            expect(response.headers.get("content-type")).toBe("application/problem+json");
            expect(response.status).toBe(500);

            const data = await response.json();

            expect(data.detail).toBe("Exploded");
            expect(data.status).toBe(500);

            expectTypeOf(data.trace).toBeString();
        });

        it("omits trace when showTrace is false", async () => {
            expect.assertions(5);

            const error = new Error("No Trace Please");
            const handler = fetchHandler(error, { showTrace: false });

            const request = new Request("http://localhost/test", {
                headers: { accept: "application/problem+json" },
            });

            const response = await handler(request);

            expect(response.headers.get("content-type")).toBe("application/problem+json");
            expect(response.status).toBe(500);

            const data = await response.json();

            expect(data.detail).toBe("No Trace Please");
            expect(data.status).toBe(500);
            expect(Object.hasOwn(data, "trace")).toBe(false);
        });

        it("returns Problem JSON when Accept is application/json", async () => {
            expect.assertions(2);

            const error = new Error("Generic Error");
            const handler = fetchHandler(error);

            const request = new Request("http://localhost/test", {
                headers: { accept: "application/json" },
            });

            const response = await handler(request);

            expect(response.status).toBe(500);
            expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
        });

        it("returns JSON:API when Accept is application/vnd.api+json", async () => {
            expect.assertions(4);

            const error = new httpErrors.BadRequest();
            const handler = fetchHandler(error);

            const request = new Request("http://localhost/test", {
                headers: { accept: "application/vnd.api+json" },
            });

            const response = await handler(request);

            expect(response.status).toBe(400);
            expect(response.headers.get("content-type")).toBe("application/vnd.api+json; charset=utf-8");

            const data = await response.json();

            expect(Array.isArray(data.errors)).toBe(true);
            expect(data.errors[0].code).toBe(400);
        });

        it("can be overridden by extraHandlers (e.g., YAML)", async () => {
            expect.assertions(2);

            const error = new httpErrors.BadRequest();
            const handler = fetchHandler(error, {
                extraHandlers: [
                    {
                        handler: (error_, _request) =>
                            new Response((error_ as Error).message, {
                                status: (error_ as HttpError).statusCode,
                            }),
                        regex: YAML_REGEX,
                    },
                ],
            });

            const request = new Request("http://localhost/test", {
                headers: { accept: "application/yaml" },
            });

            const response = await handler(request);

            expect(response.status).toBe(400);

            const body = await response.text();

            expect(body).toBe("Bad Request");
        });

        it("invokes the onError callback before negotiating", async () => {
            expect.assertions(2);

            const error = new httpErrors.BadRequest();

            let captured: Error | undefined;

            const handler = fetchHandler(error, {
                onError: (error_) => {
                    captured = error_;
                },
            });

            const response = await handler(new Request("http://localhost/test"));

            expect(captured).toBe(error);
            expect(response.status).toBe(400);
        });

        it("still produces the negotiated response when the onError callback throws", async () => {
            expect.assertions(2);

            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            try {
                const error = new httpErrors.BadRequest();

                const handler = fetchHandler(error, {
                    onError: () => {
                        throw new Error("log transport is down");
                    },
                });

                const response = await handler(new Request("http://localhost/test"));

                expect(response.status).toBe(400);

                const body = await response.text();

                expect(body).toContain("<!DOCTYPE html>");
            } finally {
                consoleSpy.mockRestore();
            }
        });

        it("fails closed (no trace) when the runtime environment cannot be determined", async () => {
            expect.assertions(2);

            // Simulate an edge/worker runtime where NODE_ENV cannot be read.
            vi.stubGlobal("process", { env: undefined });

            try {
                const error = new Error("Secret stack");
                // No explicit showTrace and no resolvable env -> traces must not
                // leak by default.
                const handler = fetchHandler(error);

                const request = new Request("http://localhost/test", {
                    headers: { accept: "application/problem+json" },
                });

                const response = await handler(request);
                const data = await response.json();

                expect(data.detail).toBe("Secret stack");
                expect(Object.hasOwn(data, "trace")).toBe(false);
            } finally {
                vi.unstubAllGlobals();
            }
        });
    });
});
