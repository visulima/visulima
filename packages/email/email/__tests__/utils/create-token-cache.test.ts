import { describe, expect, it, vi } from "vitest";

import createTokenCache from "../../src/utils/create-token-cache";

describe(createTokenCache, () => {
    it("caches the token until the skew window", async () => {
        expect.assertions(2);

        let clock = 0;
        const fetchToken = vi.fn(() => Promise.resolve({ accessToken: "a", expiresAt: 10_000 }));
        const getToken = createTokenCache(fetchToken, { now: () => clock, skewMs: 1000 });

        await getToken();
        clock = 8999;
        await getToken();

        expect(fetchToken).toHaveBeenCalledTimes(1);

        // Expiry (10000) minus skew (1000) has now been reached.
        clock = 9000;
        await getToken();

        expect(fetchToken).toHaveBeenCalledTimes(2);
    });

    it("treats a token without an expiry as never expiring", async () => {
        expect.assertions(1);

        const fetchToken = vi.fn(() => Promise.resolve({ accessToken: "a" }));
        const getToken = createTokenCache(fetchToken, { now: () => 1e12 });

        await getToken();
        await getToken();

        expect(fetchToken).toHaveBeenCalledTimes(1);
    });

    it("collapses concurrent callers into a single fetch", async () => {
        expect.assertions(2);

        const fetchToken = vi.fn(() => Promise.resolve({ accessToken: "a", expiresAt: 1e12 }));
        const getToken = createTokenCache(fetchToken, { now: () => 0 });

        const results = await Promise.all([getToken(), getToken(), getToken()]);

        expect(fetchToken).toHaveBeenCalledTimes(1);
        expect(results.map((r) => r.accessToken)).toStrictEqual(["a", "a", "a"]);
    });

    it("rejects every concurrent waiter and recovers on the next call", async () => {
        expect.assertions(3);

        const fetchToken = vi
            .fn<() => Promise<{ accessToken: string; expiresAt: number }>>()
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValue({ accessToken: "good", expiresAt: 1e12 });
        const getToken = createTokenCache(fetchToken, { now: () => 0 });

        const settled = await Promise.allSettled([getToken(), getToken()]);

        expect(settled.map((s) => s.status)).toStrictEqual(["rejected", "rejected"]);
        expect(fetchToken).toHaveBeenCalledTimes(1);

        // A failed fetch must not be cached, and must not leave the in-flight promise stuck.
        await expect(getToken()).resolves.toStrictEqual({ accessToken: "good", expiresAt: 1e12 });
    });

    it("clamps a negative skew so tokens are never served past expiry", async () => {
        expect.assertions(1);

        let clock = 0;
        const fetchToken = vi.fn(() => Promise.resolve({ accessToken: "a", expiresAt: 1000 }));
        const getToken = createTokenCache(fetchToken, { now: () => clock, skewMs: -5000 });

        await getToken();
        clock = 1000;
        await getToken();

        expect(fetchToken).toHaveBeenCalledTimes(2);
    });
});
