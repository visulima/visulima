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

    it("marks a transient DNS failure (timeout) as deferred rather than undeliverable", async () => {
        expect.assertions(3);

        const error = Object.assign(new Error("queryMx ETIMEOUT"), { code: "ETIMEOUT" });

        resolveMx.mockRejectedValue(error);
        resolve4.mockRejectedValue(new Error("ETIMEOUT"));
        resolve6.mockRejectedValue(new Error("ETIMEOUT"));

        const result = await checkMxRecords("flaky.example");

        expect(result.deferred).toBe(true);
        expect(result.valid).toBe(false);
        expect(result.resolvedVia).toBe("none");
    });

    it("treats a definitive ENOTFOUND as a non-deferred no-records answer", async () => {
        expect.assertions(2);

        const error = Object.assign(new Error("queryMx ENOTFOUND"), { code: "ENOTFOUND" });

        resolveMx.mockRejectedValue(error);
        resolve4.mockRejectedValue(new Error("ENOTFOUND"));
        resolve6.mockRejectedValue(new Error("ENOTFOUND"));

        const result = await checkMxRecords("gone.example");

        expect(result.deferred).toBeFalsy();
        expect(result.resolvedVia).toBe("none");
    });

    it("does not cache a transient (deferred) result", async () => {
        expect.assertions(2);

        const error = Object.assign(new Error("queryMx ESERVFAIL"), { code: "ESERVFAIL" });

        resolveMx.mockRejectedValue(error);
        resolve4.mockRejectedValue(new Error("ESERVFAIL"));
        resolve6.mockRejectedValue(new Error("ESERVFAIL"));

        const store = new Map<string, unknown>();
        const cache = {
            clear: vi.fn(() => Promise.resolve()),
            delete: vi.fn(() => Promise.resolve()),
            get: vi.fn((key: string) => Promise.resolve(store.get(key))),
            set: vi.fn((key: string, value: unknown) => {
                store.set(key, value);

                return Promise.resolve();
            }),
        };

        const result = await checkMxRecords("flaky.example", { cache });

        expect(result.deferred).toBe(true);
        expect(cache.set).not.toHaveBeenCalled();
    });

    it("coalesces concurrent lookups for the same domain into a single DNS query", async () => {
        expect.assertions(2);

        let release: (records: { exchange: string; priority: number }[]) => void = () => {};

        resolveMx.mockReturnValue(
            new Promise((resolve) => {
                release = resolve;
            }),
        );

        const first = checkMxRecords("concurrent.example");
        const second = checkMxRecords("concurrent.example");

        release([{ exchange: "mx.concurrent.example", priority: 10 }]);

        const [firstResult, secondResult] = await Promise.all([first, second]);

        expect(resolveMx).toHaveBeenCalledTimes(1);
        expect(firstResult).toStrictEqual(secondResult);
    });
});
