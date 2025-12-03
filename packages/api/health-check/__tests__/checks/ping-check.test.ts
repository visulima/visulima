import "cross-fetch/polyfill";

import { describe, expect, it } from "vitest";

import pingCheck from "../../src/checks/ping-check";

const consoleMessage = "Skipping DNS check in CI environment, please validate this test localy.";

describe(pingCheck, () => {
    it("should return healthy when the host is reachable", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

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
    }, 10_000);

    it("should return unhealthy when the host is reachable", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

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
