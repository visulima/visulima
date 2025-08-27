import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import httpHandler from "../../src/handler/http-handler";

describe("flame httpHandler handler", () => {
    it("returns HTML by default when no Accept header is provided", async () => {
        expect.assertions(3);

        const error = new httpErrors.BadRequest();
        const handler = await httpHandler(error, []);

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
        const handler = await httpHandler(error, []);

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "text/html" },
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
        const handler = await httpHandler(error, []);

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "application/problem+json" },
        });

        await handler(req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData());
        expect(data.details).toBe("Exploded");
        expect(typeof data.trace).toBe("string");
    });

    it("omits trace when showTrace is false", async () => {
        expect.assertions(4);

        const error = new Error("No Trace Please");
        const handler = await httpHandler(error, [], { showTrace: false });

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "application/problem+json" },
        });

        await handler(req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData());
        expect(data.details).toBe("No Trace Please");
        expect(Object.prototype.hasOwnProperty.call(data, "trace")).toBe(false);
    });

    it("returns Problem JSON when Accept is application/json", async () => {
        expect.assertions(2);

        const error = new Error("Generic Error");
        const handler = await httpHandler(error, []);

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "application/json" },
        });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        expect(String(res.getHeader("content-type"))).toBe("application/json; charset=utf-8");
    });

    it("returns JSON:API when Accept is application/vnd.api+json", async () => {
        expect.assertions(4);

        const error = new httpErrors.BadRequest();
        const handler = await httpHandler(error, []);

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "application/vnd.api+json" },
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
        const handler = await httpHandler(error, [], {
            extraHandlers: [
                {
                    regex: /application\/yaml/u,
                    handler: (err, _req, res) => {
                        // @ts-expect-error - using shape consistent with http-errors
                        res.statusCode = err.statusCode ?? 400;
                        res.end((err as Error).message);
                    },
                },
            ],
        });

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "application/yaml" },
        });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("Bad Request");
    });

    it("uses options.errorPage override when debug is false", async () => {
        expect.assertions(3);

        const error = new httpErrors.BadRequest("Page Override");
        const handler = await httpHandler(error, [], { debug: false, errorPage: "OVERRIDDEN" });

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "text/html" },
        });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        expect(String(res.getHeader("content-type"))).toBe("text/html; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("OVERRIDDEN");
    });
});
