import { describe, expect, it, vi } from "vitest";

import type { OAuth2Token } from "../../src/middleware";
import { composeMiddleware, oauth2Middleware } from "../../src/middleware";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

const okResult = (messageId = "m1"): Result<EmailResult> => {
    return {
        data: { messageId, provider: "stub", sent: true, timestamp: new Date(0) },
        success: true,
    };
};

const message: EmailOptions = {
    from: { email: "from@x.com" },
    subject: "Hi",
    text: "body",
    to: { email: "to@x.com" },
};

describe(oauth2Middleware, () => {
    it("fetches a token and injects it into the Authorization header on first send", async () => {
        expect.assertions(3);

        const fetchToken = vi.fn(() => Promise.resolve<OAuth2Token>({ accessToken: "tok-1" }));
        const next = vi.fn<(options: EmailOptions) => Promise<Result<EmailResult>>>(() => Promise.resolve(okResult()));
        const composed = composeMiddleware([oauth2Middleware({ fetchToken })], next);

        await composed(message);

        const forwarded = next.mock.calls[0]?.[0] as EmailOptions;

        expect(fetchToken).toHaveBeenCalledTimes(1);
        expect(forwarded.headers).toBeDefined();
        expect((forwarded.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    });

    it("reuses a cached token while it is still valid", async () => {
        expect.assertions(2);

        let clock = 0;
        const fetchToken = vi.fn(() => Promise.resolve<OAuth2Token>({ accessToken: "tok-1", expiresAt: 1_000_000 }));
        const next = vi.fn<(options: EmailOptions) => Promise<Result<EmailResult>>>(() => Promise.resolve(okResult()));
        const composed = composeMiddleware([oauth2Middleware({ fetchToken, now: () => clock })], next);

        await composed(message);
        clock = 100; // still well within validity (expiresAt - skewMs > now)
        await composed(message);

        expect(fetchToken).toHaveBeenCalledTimes(1);
        expect((next.mock.calls[1]?.[0] as EmailOptions).headers).toStrictEqual({ Authorization: "Bearer tok-1" });
    });

    it("refreshes an expired (within-skew) token", async () => {
        expect.assertions(2);

        let clock = 0;
        const fetchToken = vi
            .fn<() => Promise<OAuth2Token>>()
            .mockResolvedValueOnce({ accessToken: "tok-1", expiresAt: 100_000 })
            .mockResolvedValueOnce({ accessToken: "tok-2", expiresAt: 300_000 });
        const next = vi.fn<(options: EmailOptions) => Promise<Result<EmailResult>>>(() => Promise.resolve(okResult()));
        // skewMs defaults to 60_000. tok-1 is valid at clock 0 (100_000 - 60_000 = 40_000 > 0),
        // but within the skew window once the clock advances past 40_000.
        const composed = composeMiddleware([oauth2Middleware({ fetchToken, now: () => clock })], next);

        await composed(message); // tok-1 acquired and cached (still valid)
        clock = 50_000; // within skew of tok-1 expiry → must refresh
        await composed(message);

        expect(fetchToken).toHaveBeenCalledTimes(2);
        expect((next.mock.calls[1]?.[0] as EmailOptions).headers).toStrictEqual({ Authorization: "Bearer tok-2" });
    });

    it("propagates a token-endpoint failure and does not call next", async () => {
        expect.assertions(2);

        const fetchToken = vi.fn(() => Promise.reject(new Error("token endpoint 401")));
        const next = vi.fn<(options: EmailOptions) => Promise<Result<EmailResult>>>(() => Promise.resolve(okResult()));
        const composed = composeMiddleware([oauth2Middleware({ fetchToken })], next);

        await expect(composed(message)).rejects.toThrow("token endpoint 401");
        expect(next).not.toHaveBeenCalled();
    });

    it("invokes onToken with each freshly-acquired token and honours a custom scheme/header", async () => {
        expect.assertions(3);

        const onToken = vi.fn();
        const fetchToken = vi.fn(() => Promise.resolve<OAuth2Token>({ accessToken: "xoauth2-blob" }));
        const next = vi.fn<(options: EmailOptions) => Promise<Result<EmailResult>>>(() => Promise.resolve(okResult()));
        const composed = composeMiddleware([oauth2Middleware({ fetchToken, headerName: "X-Auth", onToken, scheme: "OAuth" })], next);

        await composed(message);

        expect(onToken).toHaveBeenCalledTimes(1);
        expect(onToken).toHaveBeenCalledWith({ accessToken: "xoauth2-blob" });
        expect((next.mock.calls[0]?.[0] as EmailOptions).headers).toStrictEqual({ "X-Auth": "OAuth xoauth2-blob" });
    });

    it("preserves caller-supplied headers when injecting the credential", async () => {
        expect.assertions(1);

        const fetchToken = vi.fn(() => Promise.resolve<OAuth2Token>({ accessToken: "tok-1" }));
        const next = vi.fn<(options: EmailOptions) => Promise<Result<EmailResult>>>(() => Promise.resolve(okResult()));
        const composed = composeMiddleware([oauth2Middleware({ fetchToken })], next);

        await composed({ ...message, headers: { "X-Custom": "keep-me" } });

        expect((next.mock.calls[0]?.[0] as EmailOptions).headers).toStrictEqual({
            Authorization: "Bearer tok-1",
            "X-Custom": "keep-me",
        });
    });
});
