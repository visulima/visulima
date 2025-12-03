import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, expectTypeOf, it } from "vitest";

import fetchHandler from "../../src/handler/http/fetch-handler";
import httpHandler from "../../src/handler/http/node-handler";

describe("httpHandler handler", () => {
    it("returns HTML by default when no Accept header is provided", async () => {
        expect.assertions(3);

        const error = new httpErrors.BadRequest();
        const handler = await httpHandler(error);

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
        const handler = await httpHandler(error);

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
        const handler = await httpHandler(error);

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
        const handler = await httpHandler(error, { showTrace: false });

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
        expect(Object.prototype.hasOwnProperty.call(data, "trace")).toBe(false);
    });

    it("returns Problem JSON when Accept is application/json", async () => {
        expect.assertions(2);

        const error = new Error("Generic Error");
        const handler = await httpHandler(error);

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
        const handler = await httpHandler(error);

        const { req, res } = createMocks({
            headers: { accept: "application/vnd.api+json" },
            method: "GET",
        });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData());

        expect(Array.isArray(data.errors)).toBe(true);
        expect(data.errors[0].code).toBe(400);
    });

    it("can be overridden by extraHandlers (e.g., YAML)", async () => {
        expect.assertions(2);

        const error = new httpErrors.BadRequest();
        const handler = await httpHandler(error, {
            extraHandlers: [
                {
                    handler: (error_, _request, res) => {
                        res.statusCode = (error_ as any).statusCode ?? 400;
                        res.end((error_ as Error).message);
                    },
                    regex: /application\/yaml/u,
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

    describe(fetchHandler, () => {
        it("returns HTML by default when no Accept header is provided", async () => {
            expect.assertions(3);

            const error = new httpErrors.BadRequest();
            const handler = await fetchHandler(error);

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
            const handler = await fetchHandler(error);

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
            const handler = await fetchHandler(error);

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
            const handler = await fetchHandler(error, { showTrace: false });

            const request = new Request("http://localhost/test", {
                headers: { accept: "application/problem+json" },
            });

            const response = await handler(request);

            expect(response.headers.get("content-type")).toBe("application/problem+json");
            expect(response.status).toBe(500);

            const data = await response.json();

            expect(data.detail).toBe("No Trace Please");
            expect(data.status).toBe(500);
            expect(Object.prototype.hasOwnProperty.call(data, "trace")).toBe(false);
        });

        it("returns Problem JSON when Accept is application/json", async () => {
            expect.assertions(2);

            const error = new Error("Generic Error");
            const handler = await fetchHandler(error);

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
            const handler = await fetchHandler(error);

            const request = new Request("http://localhost/test", {
                headers: { accept: "application/vnd.api+json" },
            });

            const response = await handler(request);

            expect(response.status).toBe(400);
            expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");

            const data = await response.json();

            expect(Array.isArray(data.errors)).toBe(true);
            expect(data.errors[0].code).toBe(400);
        });

        it("can be overridden by extraHandlers (e.g., YAML)", async () => {
            expect.assertions(2);

            const error = new httpErrors.BadRequest();
            const handler = await fetchHandler(error, {
                extraHandlers: [
                    {
                        handler: (error_, _request) =>
                            new Response((error_ as Error).message, {
                                status: (error_ as any).statusCode ?? 400,
                            }),
                        regex: /application\/yaml/u,
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
    });
});
