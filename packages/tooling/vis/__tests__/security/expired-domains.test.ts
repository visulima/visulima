import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearExpiredDomainsCache, runExpiredDomainsMarshall } from "../../src/security/marshalls/expired-domains";
import { clearPackumentCache } from "../../src/security/marshalls/packument";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

const stubFetch = (body: unknown): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () => {
        return {
            json: async () => body,
            ok: true,
            status: 200,
        };
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

interface MaintainerFixture {
    email?: string;
    name?: string;
}

const packumentBody = (maintainers: MaintainerFixture[]): Record<string, unknown> => {
    return {
        "dist-tags": { latest: "1.0.0" },
        name: "demo",
        versions: {
            "1.0.0": {
                _npmUser: maintainers[0],
                maintainers,
                version: "1.0.0",
            },
        },
    };
};

interface StubResolverConfig {
    nxdomain?: Set<string>;
    ok?: Set<string>;
    timeout?: Set<string>;
}

const createStubResolver = (
    config: StubResolverConfig,
): {
    resolveNs: ReturnType<typeof vi.fn>;
    setServers: ReturnType<typeof vi.fn>;
} => {
    const ok = config.ok ?? new Set();
    const nxdomain = config.nxdomain ?? new Set();
    const timeout = config.timeout ?? new Set();

    return {
        resolveNs: vi.fn(async (domain: string) => {
            if (nxdomain.has(domain)) {
                const error = new Error("ENOTFOUND") as Error & { code: string };

                error.code = "ENOTFOUND";

                throw error;
            }

            if (timeout.has(domain)) {
                return new Promise(() => {});
            }

            if (ok.has(domain)) {
                return ["ns1.example.com.", "ns2.example.com."];
            }

            return [];
        }),
        setServers: vi.fn(),
    };
};

describe(runExpiredDomainsMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-expired-domains-"));
        clearPackumentCache();
        clearExpiredDomainsCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("flags ENOTFOUND domains as expired (error)", async () => {
        expect.assertions(2);

        stubFetch(packumentBody([{ email: "user@expired.example", name: "user" }]));
        const resolver = createStubResolver({ nxdomain: new Set(["expired.example"]) });

        const findings = await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver });

        expect(findings).toHaveLength(1);
        expect(findings[0]).toStrictEqual({
            domain: "expired.example",
            kind: "expired",
            maintainer: "user@expired.example",
            packageName: "demo",
            severity: "error",
        });
    });

    it("returns no findings when domains resolve", async () => {
        expect.assertions(1);

        stubFetch(packumentBody([{ email: "user@live.example", name: "user" }]));
        const resolver = createStubResolver({ ok: new Set(["live.example"]) });

        const findings = await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver });

        expect(findings).toStrictEqual([]);
    });

    it("flags empty NS record array as expired", async () => {
        expect.assertions(1);

        stubFetch(packumentBody([{ email: "user@empty.example", name: "user" }]));
        const resolver = createStubResolver({});

        const findings = await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver });

        expect(findings[0]?.kind).toBe("expired");
    });

    it("degrades a timeout to a warning (unresolved)", async () => {
        expect.assertions(2);

        stubFetch(packumentBody([{ email: "user@slow.example", name: "user" }]));
        const resolver = createStubResolver({ timeout: new Set(["slow.example"]) });

        const findings = await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver, perDomainTimeoutMs: 50 });

        expect(findings).toHaveLength(1);
        expect(findings[0]).toStrictEqual({
            domain: "slow.example",
            kind: "unresolved",
            maintainer: "user@slow.example",
            packageName: "demo",
            severity: "warning",
        });
    });

    it("dedupes the same domain across maintainers within a package", async () => {
        expect.assertions(2);

        stubFetch(
            packumentBody([
                { email: "a@same.example", name: "a" },
                { email: "b@same.example", name: "b" },
            ]),
        );
        const resolver = createStubResolver({ nxdomain: new Set(["same.example"]) });

        const findings = await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver });

        // Two distinct maintainer emails on the same expired domain → two findings,
        // but resolveNs only fires once.
        expect(findings).toHaveLength(2);
        expect(resolver.resolveNs).toHaveBeenCalledTimes(1);
    });

    it("dedupes a shared domain across packages running in parallel (one DNS call total)", async () => {
        expect.assertions(3);

        const bodyByName = new Map<string, ReturnType<typeof packumentBody>>([
            ["alpha", { ...packumentBody([{ email: "alice@shared.example", name: "alice" }]), name: "alpha" }],
            ["beta", { ...packumentBody([{ email: "bob@shared.example", name: "bob" }]), name: "beta" }],
        ]);

        const REGISTRY_PATTERN = /registry\.npmjs\.org\/([^/]+)/;

        const fetchHandler = vi.fn(async (url: string | URL) => {
            const urlString = typeof url === "string" ? url : url.toString();
            const matched = REGISTRY_PATTERN.exec(urlString);
            const pkgName = matched?.[1] === undefined ? "" : decodeURIComponent(matched[1].replace("%2f", "/"));
            const body = bodyByName.get(pkgName) ?? bodyByName.get("alpha");

            return {
                json: async () => body,
                ok: true,
                status: 200,
            };
        });

        vi.stubGlobal("fetch", fetchHandler);

        const resolver = createStubResolver({ nxdomain: new Set(["shared.example"]) });

        const findings = await runExpiredDomainsMarshall(
            [
                { name: "alpha", version: "1.0.0" },
                { name: "beta", version: "1.0.0" },
            ],
            { createResolver: () => resolver },
        );

        expect(resolver.resolveNs).toHaveBeenCalledTimes(1);
        expect(findings).toHaveLength(2);
        expect(findings.map((entry) => entry.packageName).sort()).toStrictEqual(["alpha", "beta"]);
    });

    it("skips maintainers without a parseable email", async () => {
        expect.assertions(2);

        stubFetch(packumentBody([{ name: "noemail" }, { email: "garbage", name: "bad" }, { email: "user@", name: "atend" }]));
        const resolver = createStubResolver({});

        const findings = await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver });

        expect(findings).toStrictEqual([]);
        expect(resolver.resolveNs).not.toHaveBeenCalled();
    });

    it("respects the allowDomains list", async () => {
        expect.assertions(2);

        stubFetch(packumentBody([{ email: "user@expired.example", name: "user" }]));
        const resolver = createStubResolver({ nxdomain: new Set(["expired.example"]) });

        const findings = await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], {
            allowDomains: ["expired.example"],
            createResolver: () => resolver,
        });

        expect(findings).toStrictEqual([]);
        expect(resolver.resolveNs).not.toHaveBeenCalled();
    });

    it("respects the package allowlist", async () => {
        expect.assertions(2);

        stubFetch(packumentBody([{ email: "user@expired.example", name: "user" }]));
        const resolver = createStubResolver({ nxdomain: new Set(["expired.example"]) });

        const findings = await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { allowlist: ["demo"], createResolver: () => resolver });

        expect(findings).toStrictEqual([]);
        expect(resolver.resolveNs).not.toHaveBeenCalled();
    });

    it("caches resolved outcomes across calls", async () => {
        expect.assertions(1);

        stubFetch(packumentBody([{ email: "user@live.example", name: "user" }]));
        const resolver = createStubResolver({ ok: new Set(["live.example"]) });

        await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver });
        clearPackumentCache();
        stubFetch(packumentBody([{ email: "user@live.example", name: "user" }]));
        await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver });

        expect(resolver.resolveNs).toHaveBeenCalledTimes(1);
    });

    it("does not cache transient errors", async () => {
        expect.assertions(1);

        stubFetch(packumentBody([{ email: "user@slow.example", name: "user" }]));
        const resolver = createStubResolver({ timeout: new Set(["slow.example"]) });

        await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver, perDomainTimeoutMs: 50 });
        clearPackumentCache();
        stubFetch(packumentBody([{ email: "user@slow.example", name: "user" }]));
        // Replace resolver with a new instance for a fresh call — the in-memory
        // per-run cache is gone, and disk cache must not have stored the failure.
        const fresh = createStubResolver({ timeout: new Set(["slow.example"]) });

        await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => fresh, perDomainTimeoutMs: 50 });

        expect(fresh.resolveNs).toHaveBeenCalledTimes(1);
    });

    it("returns an empty array when MARSHALL_DISABLE_EXPIRED_DOMAINS is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_EXPIRED_DOMAINS;
        const fetchSpy = stubFetch(packumentBody([{ email: "user@expired.example", name: "user" }]));
        const resolver = createStubResolver({ nxdomain: new Set(["expired.example"]) });

        try {
            process.env.MARSHALL_DISABLE_EXPIRED_DOMAINS = "1";

            const findings = await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver });

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_EXPIRED_DOMAINS;
            } else {
                process.env.MARSHALL_DISABLE_EXPIRED_DOMAINS = previous;
            }
        }
    });
});

describe(clearExpiredDomainsCache, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-expired-domains-clear-"));
        clearPackumentCache();
        clearExpiredDomainsCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("returns 0 when the directory does not exist", () => {
        expect.assertions(1);

        expect(clearExpiredDomainsCache()).toBe(0);
    });

    it("removes every cached entry and reports the count", async () => {
        expect.assertions(2);

        stubFetch(
            packumentBody([
                { email: "user@one.example", name: "user1" },
                { email: "user@two.example", name: "user2" },
            ]),
        );
        const resolver = createStubResolver({ ok: new Set(["one.example", "two.example"]) });

        await runExpiredDomainsMarshall([{ name: "demo", version: "1.0.0" }], { createResolver: () => resolver });

        expect(clearExpiredDomainsCache()).toBe(2);
        expect(clearExpiredDomainsCache()).toBe(0);
    });
});
