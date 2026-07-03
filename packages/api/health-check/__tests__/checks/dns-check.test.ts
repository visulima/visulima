import { describe, expect, it } from "vitest";

import dnsCheck from "../../src/checks/dns-check";

describe(dnsCheck, () => {
    it("should return healthy when the host is resolved", async () => {
        expect.assertions(1);

        const result = await dnsCheck("example.com")();

        expect(result).toStrictEqual({
            displayName: "DNS check for example.com",
            health: {
                healthy: true,
                message: "DNS check for example.com were resolved.",

                timestamp: expect.any(String),
            },
            meta: {
                addresses: expect.any(Array),
                host: "example.com",
            },
        });
    });

    it("should return unhealthy when the host is not resolved", async () => {
        expect.assertions(7);

        const result = await dnsCheck("example.com", ["93.122.1212.45"], { family: 4 })();

        expect(result.displayName).toBe("DNS check for example.com");
        expect(result.health.healthy).toBe(false);
        expect(result.health.message).toContain("DNS check for example.com returned address ");
        expect(result.health.message).toContain(" instead of 93.122.1212.45.");
        expect(result.health.timestamp).toEqual(expect.any(String));
        expect(result.meta.addresses).toEqual(expect.any(Object));
        expect(result.meta.host).toBe("example.com");
    }, 10_000);

    it("should return unhealthy when the lookup throws", async () => {
        expect.assertions(4);

        const host = "this-host-does-not-exist.invalid";

        const result = await dnsCheck(host)();

        expect(result.displayName).toBe(`DNS check for ${host}`);
        expect(result.health.healthy).toBe(false);
        expect(result.health.message).toEqual(expect.any(String));
        expect(result.meta).toStrictEqual({ host });
    }, 10_000);
});
