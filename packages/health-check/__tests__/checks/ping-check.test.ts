import { describe, expect, it } from "vitest";
import "cross-fetch/polyfill";

import pingCheck from "../../src/checks/ping-check";

describe("pingCheck", () => {
    it("should return healthy when the host is reachable", async () => {
        if (process.env.CI) {
            console.log("Skipping DNS check in CI environment");
            return;
        }

        const result = await pingCheck("www.github.com")();

        expect(result).toStrictEqual({
            displayName: "Ping check for www.github.com",
            health: {
                healthy: true,
                message: "Ping check for www.github.com was successful.",
                timestamp: expect.any(String),
            },
            meta: expect.any(Object),
        });
    }, 10000);

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
