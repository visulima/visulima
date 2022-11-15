import { describe, expect, it } from "vitest";

import { pingCheck } from "../../src";

describe("pingCheck", () => {
    it("should return healthy when the host is reachable", async () => {
        const result = await pingCheck("https://example.com")();

        expect(result).toStrictEqual({
            displayName: "Ping check for https://example.com",
            health: {
                healthy: true,
                message: "Ping check for https://example.com was successful.",
                timestamp: expect.any(String),
            },
            meta: expect.any(Object),
        });
    });
    it("should return unhealthy when the host is reachable", async () => {
        const result = await pingCheck("https://example.com1")();

        expect(result).toStrictEqual({
            displayName: "Ping check for https://example.com1",
            health: {
                healthy: false,
                message: "Ping failed for https://example.com1.",
                timestamp: expect.any(String),
            },
            meta: expect.any(Object),
        });
    });
});
