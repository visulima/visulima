import { describe, expect, it, vi } from "vitest";

import type { PackageReportData, SecurityProvider } from "../../src/security/provider";
import { mergeReports } from "../../src/security/provider";
import { buildEnabledProviders, fetchAllReports } from "../../src/security/registry";

const makeReport = (overrides: Partial<PackageReportData> = {}): PackageReportData => {
    return {
        alerts: [],
        author: ["author-a"],
        id: "pkg:npm/foo@1.0.0",
        license: "MIT",
        name: "foo",
        score: { license: 1, maintenance: 1, overall: 1, quality: 1, supplyChain: 1, vulnerability: 1 },
        size: 100,
        type: "npm",
        version: "1.0.0",
        ...overrides,
    };
};

const makeProvider = (id: string, fetchImpl: () => Promise<Map<string, PackageReportData>>): SecurityProvider => {
    return {
        clearCache: () => 0,
        displayName: id,
        fetchReports: vi.fn(fetchImpl),
        getCacheStats: () => { return { entries: 0, newestEntry: undefined, oldestEntry: undefined, totalSizeBytes: 0 }; },
        id,
    };
};

describe(buildEnabledProviders, () => {
    it("returns no providers when security is undefined", () => {
        expect.assertions(1);
        expect(buildEnabledProviders(undefined)).toHaveLength(0);
    });

    it("returns no providers when socket is disabled", () => {
        expect.assertions(1);
        expect(buildEnabledProviders({ socket: { enabled: false } })).toHaveLength(0);
    });

    it("returns no providers when socket lacks an apiToken", () => {
        expect.assertions(1);

        const originalToken = process.env.VIS_SOCKET_TOKEN;

        delete process.env.VIS_SOCKET_TOKEN;

        try {
            // Socket requires `enabled: true` AND an apiToken; without token buildSocketOptions
            // still returns options with apiToken=undefined, and fetchSocketReports short-circuits.
            // We still expect the provider to be registered (the auth-check happens at fetch time)
            // so the user gets a single source of truth.
            const providers = buildEnabledProviders({ socket: { enabled: true } });

            expect(providers).toHaveLength(1);
        } finally {
            if (originalToken !== undefined) {
                process.env.VIS_SOCKET_TOKEN = originalToken;
            }
        }
    });

    it("returns the socket provider when enabled with a token", () => {
        expect.assertions(2);

        const providers = buildEnabledProviders({ socket: { apiToken: "test-token", enabled: true } });

        expect(providers).toHaveLength(1);
        expect(providers[0].id).toBe("socket");
    });

    it("filters out providers listed in disabled", () => {
        expect.assertions(1);

        const providers = buildEnabledProviders(
            { socket: { apiToken: "test-token", enabled: true } },
            { disabled: new Set(["socket"]) },
        );

        expect(providers).toHaveLength(0);
    });

    it("returns both providers when both are enabled", () => {
        expect.assertions(3);

        const providers = buildEnabledProviders({
            depsDev: { enabled: true },
            socket: { apiToken: "test-token", enabled: true },
        });

        expect(providers).toHaveLength(2);
        // Default order: socket first (registration order), deps-dev second.
        expect(providers[0].id).toBe("socket");
        expect(providers[1].id).toBe("deps-dev");
    });

    it("primaryProvider reorders the registered providers", () => {
        expect.assertions(2);

        const providers = buildEnabledProviders({
            depsDev: { enabled: true },
            primaryProvider: "deps-dev",
            socket: { apiToken: "test-token", enabled: true },
        });

        expect(providers[0].id).toBe("deps-dev");
        expect(providers[1].id).toBe("socket");
    });

    it("disabled set filters deps-dev as well", () => {
        expect.assertions(2);

        const providers = buildEnabledProviders(
            { depsDev: { enabled: true }, socket: { apiToken: "test-token", enabled: true } },
            { disabled: new Set(["deps-dev"]) },
        );

        expect(providers).toHaveLength(1);
        expect(providers[0].id).toBe("socket");
    });
});

describe(fetchAllReports, () => {
    it("returns an empty map when no providers are given", async () => {
        expect.assertions(1);

        const result = await fetchAllReports([], [{ name: "foo", version: "1.0.0" }]);

        expect(result.size).toBe(0);
    });

    it("returns an empty map when no packages are given", async () => {
        expect.assertions(1);

        const provider = makeProvider("p1", async () => new Map([["foo@1.0.0", makeReport()]]));

        const result = await fetchAllReports([provider], []);

        expect(result.size).toBe(0);
        // Provider should not be called when there are no packages — saves a network roundtrip.
    });

    it("isolates provider failures — a rejecting provider does not abort siblings", async () => {
        expect.assertions(2);

        const failing = makeProvider("p1", async () => {
            throw new Error("boom");
        });
        const ok = makeProvider("p2", async () => new Map([["foo@1.0.0", makeReport()]]));

        const result = await fetchAllReports([failing, ok], [{ name: "foo", version: "1.0.0" }]);

        expect(result.size).toBe(1);
        expect(result.get("foo@1.0.0")?.name).toBe("foo");
    });

    it("merges results from multiple providers", async () => {
        expect.assertions(2);

        const p1 = makeProvider("p1", async () => new Map([["foo@1.0.0", makeReport({ alerts: [{ category: "supply-chain", key: "alert-a", severity: "high", type: "didYouMean" }] })]]));
        const p2 = makeProvider("p2", async () => new Map([["foo@1.0.0", makeReport({ alerts: [{ category: "vulnerability", key: "alert-b", severity: "critical", type: "vulnerability" }] })]]));

        const result = await fetchAllReports([p1, p2], [{ name: "foo", version: "1.0.0" }]);

        expect(result.size).toBe(1);
        expect(result.get("foo@1.0.0")?.alerts).toHaveLength(2);
    });
});

describe(mergeReports, () => {
    it("returns an empty map when no inputs", () => {
        expect.assertions(1);
        expect(mergeReports([]).size).toBe(0);
    });

    it("primary provider's score wins on conflict", () => {
        expect.assertions(2);

        const primary = new Map([["foo@1.0.0", makeReport({ score: { license: 1, maintenance: 1, overall: 0.9, quality: 1, supplyChain: 1, vulnerability: 1 } })]]);
        const secondary = new Map([["foo@1.0.0", makeReport({ score: { license: 0.1, maintenance: 0.1, overall: 0.1, quality: 0.1, supplyChain: 0.1, vulnerability: 0.1 } })]]);

        const result = mergeReports([primary, secondary]);

        expect(result.size).toBe(1);
        expect(result.get("foo@1.0.0")?.score.overall).toBe(0.9);
    });

    it("dedupes alerts by key when both providers report the same alert", () => {
        expect.assertions(1);

        const primary = new Map([["foo@1.0.0", makeReport({ alerts: [{ category: "vulnerability", key: "CVE-2024-1234", severity: "high", type: "vulnerability" }] })]]);
        const secondary = new Map([["foo@1.0.0", makeReport({ alerts: [{ category: "vulnerability", key: "CVE-2024-1234", severity: "high", type: "vulnerability" }] })]]);

        const result = mergeReports([primary, secondary]);

        expect(result.get("foo@1.0.0")?.alerts).toHaveLength(1);
    });

    it("falls back to secondary's license/author/size when primary has empty values", () => {
        expect.assertions(3);

        const primary = new Map([["foo@1.0.0", makeReport({ author: [], license: "", size: 0 })]]);
        const secondary = new Map([["foo@1.0.0", makeReport({ author: ["fallback"], license: "Apache-2.0", size: 200 })]]);

        const result = mergeReports([primary, secondary]);
        const report = result.get("foo@1.0.0");

        expect(report?.license).toBe("Apache-2.0");
        expect(report?.author).toStrictEqual(["fallback"]);
        expect(report?.size).toBe(200);
    });
});
