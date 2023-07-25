import { describe, expect, it } from "vitest";

import dnsCheck from "../../src/checks/dns-check";

describe("dnsCheck", () => {
    it("should return healthy when the host is resolved", async () => {
        const result = await dnsCheck("example.com")();

        expect(result).toStrictEqual({
            displayName: "DNS check for example.com",
            health: {
                healthy: true,
                message: "DNS check for example.com were resolved.",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                timestamp: expect.any(String),
            },
            meta: {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                addresses: expect.any(Array),
                host: "example.com",
            },
        });
    });

    it("should return unhealthy when the host is not resolved", async () => {
        const result = await dnsCheck("example.com", ["93.122.1212.45"], { family: 4 })();

        expect(result).toStrictEqual({
            displayName: "DNS check for example.com",
            health: {
                healthy: false,
                message: "DNS check for example.com returned address 93.184.216.34 instead of 93.122.1212.45.",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                timestamp: expect.any(String),
            },
            meta: {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                addresses: expect.any(Object),
                host: "example.com",
            },
        });
    }, 10_000);
});
