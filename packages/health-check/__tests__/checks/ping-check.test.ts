import "cross-fetch/polyfill";

import { describe, expect, it } from "vitest";

import pingCheck from "../../src/checks/ping-check";

const consoleMessage = "Skipping DNS check in CI environment, please validate this test localy.";

describe("pingCheck", () => {
    it("should return healthy when the host is reachable", async () => {
        // eslint-disable-next-line vitest/no-conditional-in-test,vitest/no-conditional-tests
        if (process.env["CI"]) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);
            return;
        }

        expect.assertions(1);

        const result = await pingCheck("www.github.com")();

        expect(result).toStrictEqual({
            displayName: "Ping check for www.github.com",
            health: {
                healthy: true,
                message: "Ping check for www.github.com was successful.",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                timestamp: expect.any(String),
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            meta: expect.any(Object),
        });
    }, 10_000);

    it("should return unhealthy when the host is reachable", async () => {
        // eslint-disable-next-line vitest/no-conditional-in-test,vitest/no-conditional-tests
        if (process.env["CI"]) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);
            return;
        }

        expect.assertions(1);

        const result = await pingCheck("https://example.com1")();

        expect(result).toStrictEqual({
            displayName: "Ping check for https://example.com1",
            health: {
                healthy: false,
                message: "Ping failed for https://example.com1.",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                timestamp: expect.any(String),
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            meta: expect.any(Object),
        });
    });
});
