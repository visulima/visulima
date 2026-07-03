import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOAuthRefreshHandle } from "../../src/utils/oauth-refresh";

describe(createOAuthRefreshHandle, () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, "fetch");
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        vi.useRealTimers();
    });

    it("fetches a token on first call and caches it", async () => {
        expect.assertions(3);

        fetchSpy.mockResolvedValue({
            json: async () => {
                return { access_token: "tok-1", expires_in: 3600 };
            },
            ok: true,
        });

        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams({ grant_type: "refresh_token" }),
            provider: "Test",
            tokenUrl: "https://example/token",
        });

        const t1 = await handle.getAccessToken();
        const t2 = await handle.getAccessToken();

        expect(t1).toBe("tok-1");
        expect(t2).toBe("tok-1");
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("refreshes when the cached token is within the leeway window", async () => {
        expect.assertions(3);

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

        fetchSpy
            .mockResolvedValueOnce({
                json: async () => {
                    return { access_token: "tok-1", expires_in: 100 };
                },
                ok: true,
            })
            .mockResolvedValueOnce({
                json: async () => {
                    return { access_token: "tok-2", expires_in: 100 };
                },
                ok: true,
            });

        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams({ grant_type: "refresh_token" }),
            leewayMs: 60_000,
            provider: "Test",
            tokenUrl: "https://example/token",
        });

        const t1 = await handle.getAccessToken();

        // Advance 50s — still inside the cached 100s lifetime (50 > 100 - 60? no, leeway burns the last 60s).
        // 50s elapsed, 50s remaining < 60s leeway → should refresh.
        vi.setSystemTime(new Date("2026-01-01T00:00:50Z"));
        const t2 = await handle.getAccessToken();

        expect(t1).toBe("tok-1");
        expect(t2).toBe("tok-2");
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("falls back to 3600s when expires_in is missing", async () => {
        expect.assertions(2);

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

        fetchSpy.mockResolvedValue({
            json: async () => {
                return { access_token: "tok-1" };
            },
            ok: true,
        });

        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams(),
            leewayMs: 60_000,
            provider: "Test",
            tokenUrl: "https://example/token",
        });

        await handle.getAccessToken();

        // Advance 60min minus leeway. With 3600s lifetime and 60s leeway,
        // refresh would trigger at 3540s in. At 3530s we should still be cached.
        vi.setSystemTime(new Date("2026-01-01T00:58:50Z"));
        await handle.getAccessToken();

        expect(fetchSpy).toHaveBeenCalledTimes(1);

        // At 3550s in (within the 60s leeway), should refresh.
        vi.setSystemTime(new Date("2026-01-01T00:59:11Z"));
        await handle.getAccessToken();

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("calls onRefresh after each successful refresh", async () => {
        expect.assertions(2);

        fetchSpy.mockResolvedValue({
            json: async () => {
                return { access_token: "tok-1", expires_in: 3600 };
            },
            ok: true,
        });

        const onRefresh = vi.fn();
        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams(),
            onRefresh,
            provider: "Test",
            tokenUrl: "https://example/token",
        });

        await handle.getAccessToken();

        expect(onRefresh).toHaveBeenCalledTimes(1);
        expect(onRefresh).toHaveBeenCalledWith("tok-1");
    });

    it("dedupes concurrent cache-miss calls into a single token exchange (single-flight)", async () => {
        expect.assertions(4);

        let resolveFetch: (value: unknown) => void = () => {};

        fetchSpy.mockReturnValue(
            new Promise((resolve) => {
                resolveFetch = resolve;
            }),
        );

        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams(),
            provider: "Test",
            tokenUrl: "https://example/token",
        });

        const p1 = handle.getAccessToken();
        const p2 = handle.getAccessToken();
        const p3 = handle.getAccessToken();

        // All three observe the same in-flight exchange.
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        resolveFetch({
            json: async () => {
                return { access_token: "tok-shared", expires_in: 3600 };
            },
            ok: true,
        });

        const [t1, t2, t3] = await Promise.all([p1, p2, p3]);

        expect(t1).toBe("tok-shared");
        expect(t2).toBe("tok-shared");
        expect(t3).toBe("tok-shared");
    });

    it("calls onRefreshToken when the provider rotates the refresh_token", async () => {
        expect.assertions(2);

        fetchSpy.mockResolvedValue({
            json: async () => {
                return { access_token: "tok-1", expires_in: 3600, refresh_token: "rotated-refresh" };
            },
            ok: true,
        });

        const onRefreshToken = vi.fn();
        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams(),
            onRefreshToken,
            provider: "Box",
            tokenUrl: "https://example/token",
        });

        await handle.getAccessToken();

        expect(onRefreshToken).toHaveBeenCalledTimes(1);
        expect(onRefreshToken).toHaveBeenCalledWith("rotated-refresh");
    });

    it("does not call onRefreshToken when no refresh_token is returned", async () => {
        expect.assertions(1);

        fetchSpy.mockResolvedValue({
            json: async () => {
                return { access_token: "tok-1", expires_in: 3600 };
            },
            ok: true,
        });

        const onRefreshToken = vi.fn();
        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams(),
            onRefreshToken,
            provider: "Test",
            tokenUrl: "https://example/token",
        });

        await handle.getAccessToken();

        expect(onRefreshToken).not.toHaveBeenCalled();
    });

    it("retries the exchange after a failed in-flight call (clears single-flight on rejection)", async () => {
        expect.assertions(2);

        fetchSpy
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: "Server Error",
                text: async () => "boom",
            })
            .mockResolvedValueOnce({
                json: async () => {
                    return { access_token: "tok-after-retry", expires_in: 3600 };
                },
                ok: true,
            });

        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams(),
            provider: "Test",
            tokenUrl: "https://example/token",
        });

        await expect(handle.getAccessToken()).rejects.toThrow(/token exchange failed/);

        // A subsequent call must be able to start a fresh exchange.
        await expect(handle.getAccessToken()).resolves.toBe("tok-after-retry");
    });

    it("throws a provider-prefixed error on non-2xx", async () => {
        expect.assertions(1);

        fetchSpy.mockResolvedValue({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            text: async () => "invalid_grant",
        });

        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams(),
            provider: "Dropbox",
            tokenUrl: "https://example/token",
        });

        await expect(handle.getAccessToken()).rejects.toThrow(/Dropbox: token exchange failed \(400\): invalid_grant/);
    });

    it("throws when the response is missing access_token", async () => {
        expect.assertions(1);

        fetchSpy.mockResolvedValue({
            json: async () => {
                return { expires_in: 3600 };
            },
            ok: true,
        });

        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams(),
            provider: "OneDrive",
            tokenUrl: "https://example/token",
        });

        await expect(handle.getAccessToken()).rejects.toThrow(/OneDrive: token response missing access_token/);
    });

    it("pOSTs the buildBody output as application/x-www-form-urlencoded", async () => {
        expect.assertions(3);

        fetchSpy.mockResolvedValue({
            json: async () => {
                return { access_token: "tok", expires_in: 3600 };
            },
            ok: true,
        });

        const handle = createOAuthRefreshHandle({
            buildBody: () => new URLSearchParams({ client_id: "abc", grant_type: "refresh_token" }),
            provider: "Test",
            tokenUrl: "https://example/token",
        });

        await handle.getAccessToken();

        const [url, init] = fetchSpy.mock.calls[0]!;

        expect(url).toBe("https://example/token");
        expect((init as RequestInit).method).toBe("POST");
        expect((init as RequestInit).headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    });
});
