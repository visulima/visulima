import { describe, expect, it } from "vitest";

import { httpCheck } from "../../src";

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
    });

    it("should return healthy when the host is reachable with post method", async () => {
        const result = await httpCheck("https://example.com", { method: "POST" }, { status: 200 })();

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
    })
});
