import "cross-fetch/polyfill";

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { server } from "../../__fixtures__/mock-server";
import httpCheck from "../../src/checks/http-check";

describe(httpCheck, () => {
    beforeAll(() => {
        server.listen();
    });
    afterEach(() => {
        server.resetHandlers();
    });
    afterAll(() => {
        server.close();
    });

    it("should return healthy when the host is reachable", async () => {
        expect.assertions(1);

        const result = await httpCheck("https://example.com")();

        expect(result).toStrictEqual({
            displayName: "HTTP check for https://example.com",
            health: {
                healthy: true,

                message: "HTTP check for https://example.com was successful.",

                timestamp: expect.any(String),
            },
            meta: {
                host: "https://example.com",
                method: "GET",
                status: 200,
            },
        });
    }, 5000);

    it("should return healthy when the host is reachable with post method", async () => {
        expect.assertions(1);

        const result = await httpCheck("https://example.com", {
            expected: { status: 200 },
            fetchOptions: {
                method: "POST",
            },
        })();

        expect(result).toStrictEqual({
            displayName: "HTTP check for https://example.com",
            health: {
                healthy: true,
                message: "HTTP check for https://example.com was successful.",
                timestamp: expect.any(String),
            },
            meta: {
                host: "https://example.com",
                method: "POST",
                status: 200,
            },
        });
    }, 5000);

    it("should return healthy when the host is reachable with post method and body", async () => {
        expect.assertions(1);

        const result = await httpCheck("https://example.com", {
            expected: { status: 200 },
            fetchOptions: {
                body: "hello world",
                method: "POST",
            },
        })();

        expect(result).toStrictEqual({
            displayName: "HTTP check for https://example.com",
            health: {
                healthy: true,
                message: "HTTP check for https://example.com was successful.",
                timestamp: expect.any(String),
            },
            meta: {
                host: "https://example.com",
                method: "POST",
                status: 200,
            },
        });
    }, 5000);

    it("should return unhealthy when the status is not the expected one", async () => {
        expect.assertions(1);

        const result = await httpCheck("https://example.com", {
            expected: { status: 404 },
        })();

        expect(result).toStrictEqual({
            displayName: "HTTP check for https://example.com",
            health: {
                healthy: false,
                message: "HTTP check for https://example.com returned status 200 instead of 404",

                timestamp: expect.any(String),
            },
            meta: {
                host: "https://example.com",
                method: "GET",
            },
        });
    }, 5000);

    it("should return unhealthy when the body is not the expected one", async () => {
        expect.assertions(1);

        const result = await httpCheck("https://example.com", {
            expected: { body: "hello world" },
        })();

        expect(result).toStrictEqual({
            displayName: "HTTP check for https://example.com",
            health: {
                healthy: false,

                message: expect.any(String),

                timestamp: expect.any(String),
            },
            meta: {
                host: "https://example.com",
                method: "GET",
            },
        });
    }, 5000);

    it("should return unhealthy when the request exceeds the timeout", async () => {
        expect.assertions(2);

        server.use(
            http.get("https://slow.example.com", async () => {
                await new Promise((resolve) => {
                    setTimeout(resolve, 200);
                });

                return HttpResponse.text("ok");
            }),
        );

        const result = await httpCheck("https://slow.example.com", { timeout: 20 })();

        expect(result.health.healthy).toBe(false);
        expect(result.meta).toStrictEqual({ host: "https://slow.example.com", method: "GET" });
    }, 5000);
});
