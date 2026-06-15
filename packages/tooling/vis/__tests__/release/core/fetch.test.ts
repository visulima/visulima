/**
 * Coverage for `safeFetchVersionMetadata` proxy plumbing.
 *
 * The SSRF + UA guards live in their own suites (see `version-actions-*.test.ts`
 * — each adapter exercises them end-to-end). This file pins down the new
 * `httpProxy` knob that wires undici's `ProxyAgent` into the request's
 * `dispatcher` option, mirroring what enterprise networks need.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetProxyAgentCacheForTests, safeFetchVersionMetadata } from "../../../src/release/core/version-actions/fetch";

describe("safeFetchVersionMetadata — httpProxy → undici ProxyAgent", () => {
    beforeEach(() => {
        __resetProxyAgentCacheForTests();
    });

    it("attaches a `dispatcher` to the fetch init when httpProxy is set", async () => {
        const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));

        await safeFetchVersionMetadata("https://registry.example/foo", {
            fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
            httpProxy: "http://proxy.acme.com:8080",
        });

        expect(fetchImpl).toHaveBeenCalledTimes(1);

        const [, init] = fetchImpl.mock.calls[0]!;

        // The dispatcher is an undici-specific extension on RequestInit.
        // It must be present (truthy) when httpProxy is configured.
        expect((init as RequestInit & { dispatcher?: unknown }).dispatcher).toBeDefined();
    });

    it("omits `dispatcher` when httpProxy is not set", async () => {
        const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));

        await safeFetchVersionMetadata("https://registry.example/foo", {
            fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
        });

        const [, init] = fetchImpl.mock.calls[0]!;

        expect((init as RequestInit & { dispatcher?: unknown }).dispatcher).toBeUndefined();
    });

    it("reuses a single ProxyAgent across consecutive requests to the same proxy", async () => {
        const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));

        await safeFetchVersionMetadata("https://a.example", {
            fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
            httpProxy: "http://proxy.acme.com:8080",
        });
        await safeFetchVersionMetadata("https://b.example", {
            fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
            httpProxy: "http://proxy.acme.com:8080",
        });

        const dispatcher1 = (fetchImpl.mock.calls[0]![1] as RequestInit & { dispatcher?: unknown }).dispatcher;
        const dispatcher2 = (fetchImpl.mock.calls[1]![1] as RequestInit & { dispatcher?: unknown }).dispatcher;

        // Both calls should share the same dispatcher instance — that's
        // the connection-pool reuse the cache exists for.
        expect(dispatcher1).toBe(dispatcher2);
    });
});
