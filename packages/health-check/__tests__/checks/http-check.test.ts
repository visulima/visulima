import { describe, expect, it } from "vitest";
import "cross-fetch/polyfill";

import httpCheck from "../../src/checks/http-check";

describe("httpCheck", () => {
    it("should return healthy when the host is reachable", async () => {
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
        const result = await httpCheck("https://example.com", {
            fetchOptions: {
                method: "POST",
            },
            expected: { status: 200 },
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
        const result = await httpCheck("https://example.com", {
            fetchOptions: {
                method: "POST",
                body: "hello world",
            },
            expected: { status: 200 },
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
});
