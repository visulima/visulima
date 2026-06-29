import { afterEach, describe, expect, it, vi } from "vitest";

// These tests exercise the DNS resolution paths of `checkMxRecords` by mocking
// `node:dns/promises`, so no real network lookup happens.

const resolveMx = vi.fn<(domain: string) => Promise<{ exchange: string; priority: number }[]>>();
const resolve4 = vi.fn<(domain: string) => Promise<string[]>>();
const resolve6 = vi.fn<(domain: string) => Promise<string[]>>();

vi.mock(import("node:dns/promises"), () => {
    return {
        resolve4: (domain: string) => resolve4(domain),
        resolve6: (domain: string) => resolve6(domain),
        resolveMx: (domain: string) => resolveMx(domain),
    };
});

// eslint-disable-next-line import/first
import { checkMxRecords } from "../src/checks/mx";

describe(checkMxRecords, () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns the published MX records, sorted by priority", async () => {
        expect.assertions(2);

        resolveMx.mockResolvedValue([
            { exchange: "alt.aspmx.l.google.com", priority: 20 },
            { exchange: "aspmx.l.google.com", priority: 10 },
        ]);

        const result = await checkMxRecords("example.com");

        expect(result.resolvedVia).toBe("mx");
        expect(result.records).toStrictEqual([
            { exchange: "aspmx.l.google.com", priority: 10 },
            { exchange: "alt.aspmx.l.google.com", priority: 20 },
        ]);
    });

    it("synthesizes an implicit priority-0 MX record from an A-record fallback (RFC 5321)", async () => {
        expect.assertions(4);

        resolveMx.mockResolvedValue([]);
        resolve4.mockResolvedValue(["203.0.113.1"]);

        const result = await checkMxRecords("implicit-mx.example");

        expect(result.valid).toBe(true);
        expect(result.resolvedVia).toBe("address");
        // The bare domain is synthesized as the implicit MX so downstream provider
        // classification and the SMTP probe can run.
        expect(result.records).toStrictEqual([{ exchange: "implicit-mx.example", priority: 0 }]);
        expect(result.records).toHaveLength(1);
    });

    it("reports the domain as undeliverable when neither MX nor address resolves", async () => {
        expect.assertions(2);

        resolveMx.mockResolvedValue([]);
        resolve4.mockRejectedValue(new Error("ENOTFOUND"));
        resolve6.mockRejectedValue(new Error("ENOTFOUND"));

        const result = await checkMxRecords("nothing-here.example");

        expect(result.valid).toBe(false);
        expect(result.resolvedVia).toBe("none");
    });

    it("does not synthesize an implicit MX when the address fallback is disabled", async () => {
        expect.assertions(2);

        resolveMx.mockResolvedValue([]);
        resolve4.mockResolvedValue(["203.0.113.1"]);

        const result = await checkMxRecords("implicit-mx.example", { fallbackToAddress: false });

        expect(result.valid).toBe(false);
        expect(result.resolvedVia).toBe("none");
    });
});
