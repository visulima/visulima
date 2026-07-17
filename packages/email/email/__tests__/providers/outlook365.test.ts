import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { outlook365Provider } from "../../src/providers/outlook365/index";
import type { Outlook365EmailOptions } from "../../src/providers/outlook365/types";
import { makeRequest } from "../../src/utils/make-request";

const MISSING_TENANT_AND_CLIENT = /'tenantId', 'clientId'/;
const MISSING_REFRESH_TOKEN = /'refreshToken'/;

vi.mock(import("../../src/utils/make-request"), () => {
    return { makeRequest: vi.fn() };
});
vi.mock(import("../../src/utils/retry"), () => {
    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        default: vi.fn(async (function_) => await function_()),
    };
});

describe(outlook365Provider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws when no auth mode is configured", () => {
        expect.assertions(1);

        expect(() => outlook365Provider({} as any)).toThrow(RequiredOptionError);
    });

    it("calls getAccessToken and posts to the me/sendMail endpoint", async () => {
        expect.assertions(4);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValueOnce({ data: { body: "", statusCode: 202 }, success: true });

        const getAccessToken = vi.fn().mockResolvedValue("ya29.token");
        const provider = outlook365Provider({ getAccessToken });
        const options: Outlook365EmailOptions = { from: { email: "from@x.com" }, html: "<p>Hi</p>", subject: "Hi", to: { email: "to@x.com" } };
        const result = await provider.sendEmail(options);

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBeDefined();
        expect(getAccessToken).toHaveBeenCalledTimes(1);

        const [url] = makeRequestMock.mock.calls[0];

        expect(String(url)).toContain("/me/sendMail");
    });

    it("targets a specific mailbox when userId is set", async () => {
        expect.assertions(1);

        const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

        makeRequestMock.mockResolvedValueOnce({ data: { body: "", statusCode: 202 }, success: true });

        const provider = outlook365Provider({ accessToken: "tok", userId: "sender@contoso.com" });

        await provider.sendEmail({ from: { email: "from@x.com" }, subject: "s", text: "t", to: { email: "t@x.com" } });

        expect(String(makeRequestMock.mock.calls[0][0])).toContain("/users/sender@contoso.com/sendMail");
    });

    describe("oAuth2 flows", () => {
        const TOKEN_URL = "/oauth2/v2.0/token";
        const tokenResponse = (body: Record<string, unknown> = {}) => {
            return { data: { body: { access_token: "graph-token", expires_in: 3600, ...body }, statusCode: 200 }, success: true };
        };
        const sendResponse = { data: { body: "", statusCode: 202 }, success: true };
        const email: Outlook365EmailOptions = { from: { email: "from@x.com" }, subject: "s", text: "t", to: { email: "to@x.com" } };

        const appOnlyConfig = {
            clientId: "client-id",
            clientSecret: "client-secret",
            tenantId: "tenant-id",
            userId: "sender@contoso.com",
        };

        // Select calls by URL rather than by index: token and send requests interleave in one
        // global mock log, so positional assertions break whenever a request is added.
        const callsTo = (fragment: string): unknown[][] => (makeRequest as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => String(url).includes(fragment));
        const tokenCalls = (): unknown[][] => callsTo(TOKEN_URL);
        const sendCalls = (): unknown[][] => callsTo("/sendMail");
        const formBody = (call: unknown[]): Record<string, string> => Object.fromEntries(new URLSearchParams(call[2] as string));
        const authHeader = (call: unknown[]): string => (call[1] as { headers: Record<string, string> }).headers.Authorization;

        it("exchanges client credentials for a token and sends with it", async () => {
            expect.assertions(5);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse);

            const result = await outlook365Provider(appOnlyConfig).sendEmail(email);

            expect(result.success).toBe(true);
            expect(String(tokenCalls()[0][0])).toBe("https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token");
            expect((tokenCalls()[0][1] as { method: string }).method).toBe("POST");
            expect(formBody(tokenCalls()[0])).toStrictEqual({
                client_id: "client-id",
                client_secret: "client-secret",
                grant_type: "client_credentials",
                scope: "https://graph.microsoft.com/.default",
            });
            expect(authHeader(sendCalls()[0])).toBe("Bearer graph-token");
        });

        it("requires an explicit userId for the app-only flow, since Graph has no app-only 'me'", () => {
            expect.assertions(2);

            expect(() => outlook365Provider({ ...appOnlyConfig, userId: undefined })).toThrow("requires an explicit 'userId'");
            expect(() => outlook365Provider({ ...appOnlyConfig, userId: "me" })).toThrow("requires an explicit 'userId'");
        });

        it("exchanges a refresh token for a token in the delegated flow", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse);

            // No userId — the delegated flow may target the token owner's own mailbox.
            const result = await outlook365Provider({ clientId: "client-id", refreshToken: "refresh-token", tenantId: "tenant-id" }).sendEmail(email);

            expect(result.success).toBe(true);
            expect(formBody(tokenCalls()[0])).toStrictEqual({
                client_id: "client-id",
                grant_type: "refresh_token",
                refresh_token: "refresh-token",
                scope: "https://graph.microsoft.com/Mail.Send offline_access",
            });
        });

        it("requires tenantId and clientId for the built-in flows, naming every missing option", () => {
            expect.assertions(2);

            expect(() => outlook365Provider({ clientSecret: "s", userId: "u@x.com" })).toThrow(RequiredOptionError);
            expect(() => outlook365Provider({ clientSecret: "s", userId: "u@x.com" })).toThrow(MISSING_TENANT_AND_CLIENT);
        });

        it("reports the missing credential for an explicitly pinned mode", () => {
            expect.assertions(1);

            expect(() => outlook365Provider({ authMode: "refreshToken", clientId: "c", tenantId: "t" })).toThrow(MISSING_REFRESH_TOKEN);
        });

        it("pins the flow via authMode when a config matches both built-in flows", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse);

            // Without authMode this config infers the delegated flow, since refreshToken wins.
            const result = await outlook365Provider({ ...appOnlyConfig, authMode: "clientCredentials", refreshToken: "stale-leftover" }).sendEmail(email);

            expect(result.success).toBe(true);
            expect(formBody(tokenCalls()[0]).grant_type).toBe("client_credentials");
        });

        it("warns when the chosen flow ignores configured credentials", () => {
            expect.assertions(1);

            const warn = vi.fn();

            outlook365Provider({ ...appOnlyConfig, authMode: "clientCredentials", logger: { ...console, warn } as unknown as Console, refreshToken: "stale" });

            expect(warn.mock.calls[0][0]).toContain("ignores these configured options: refreshToken");
        });

        it("caches the token across sends and refreshes it once expired", async () => {
            expect.assertions(4);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            let clock = 0;

            makeRequestMock
                .mockResolvedValueOnce(tokenResponse({ access_token: "first" }))
                .mockResolvedValueOnce(sendResponse)
                .mockResolvedValueOnce(sendResponse)
                .mockResolvedValueOnce(tokenResponse({ access_token: "second" }))
                .mockResolvedValueOnce(sendResponse);

            const provider = outlook365Provider({ ...appOnlyConfig, now: () => clock });

            await provider.sendEmail(email);
            await provider.sendEmail(email);

            expect(tokenCalls()).toHaveLength(1);
            expect(sendCalls()).toHaveLength(2);

            // Past expiry minus the refresh skew.
            clock = 3_600_000;

            await provider.sendEmail(email);

            expect(tokenCalls()).toHaveLength(2);
            expect(authHeader(sendCalls()[2])).toBe("Bearer second");
        });

        it("honours tokenRefreshSkewMs", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            let clock = 0;

            makeRequestMock.mockResolvedValue(sendResponse);
            makeRequestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse);

            // Expiry is 3_600_000; a 10-minute skew must force a refresh 10 minutes early.
            const provider = outlook365Provider({ ...appOnlyConfig, now: () => clock, tokenRefreshSkewMs: 600_000 });

            await provider.sendEmail(email);

            clock = 2_999_999;
            await provider.sendEmail(email);

            expect(tokenCalls()).toHaveLength(1);

            clock = 3_000_000;
            makeRequestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse);
            await provider.sendEmail(email);

            expect(tokenCalls()).toHaveLength(2);
        });

        it("applies a scopes override", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse);

            await outlook365Provider({ ...appOnlyConfig, scopes: ["https://graph.microsoft.us/.default"] }).sendEmail(email);

            expect(formBody(tokenCalls()[0]).scope).toBe("https://graph.microsoft.us/.default");
        });

        it("normalises a sovereign-cloud authority with a trailing slash", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse);

            await outlook365Provider({ ...appOnlyConfig, authority: "https://login.microsoftonline.us///" }).sendEmail(email);

            expect(String(tokenCalls()[0][0])).toBe("https://login.microsoftonline.us/tenant-id/oauth2/v2.0/token");
        });

        it("collapses concurrent sends into a single token request", async () => {
            expect.assertions(1);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValue(sendResponse);

            const provider = outlook365Provider(appOnlyConfig);

            await Promise.all([provider.sendEmail(email), provider.sendEmail(email), provider.sendEmail(email)]);

            expect(tokenCalls()).toHaveLength(1);
        });

        it("adopts and reports a rotated refresh token", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            let clock = 0;

            makeRequestMock
                .mockResolvedValueOnce(tokenResponse({ refresh_token: "rotated-token" }))
                .mockResolvedValueOnce(sendResponse)
                .mockResolvedValueOnce(tokenResponse())
                .mockResolvedValueOnce(sendResponse);

            const onRefreshToken = vi.fn();
            const provider = outlook365Provider({
                clientId: "client-id",
                now: () => clock,
                onRefreshToken,
                refreshToken: "original-token",
                tenantId: "tenant-id",
            });

            await provider.sendEmail(email);

            expect(onRefreshToken).toHaveBeenCalledWith("rotated-token");

            clock = 3_600_000;

            await provider.sendEmail(email);

            // The second refresh must use the rotated token — replaying the original fails once
            // Azure AD has rotation enabled.
            expect(formBody(tokenCalls()[1]).refresh_token).toBe("rotated-token");
        });

        it("awaits an async onRefreshToken before handing out the token", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce(tokenResponse({ refresh_token: "rotated-token" })).mockResolvedValueOnce(sendResponse);

            const order: string[] = [];
            const provider = outlook365Provider({
                clientId: "client-id",
                onRefreshToken: async () => {
                    await Promise.resolve();
                    order.push("persisted");
                },
                refreshToken: "original-token",
                tenantId: "tenant-id",
            });

            const result = await provider.sendEmail(email);

            order.push("sent");

            expect(result.success).toBe(true);
            expect(order).toStrictEqual(["persisted", "sent"]);
        });

        it("logs, but does not fail the send, when persisting a rotated token rejects", async () => {
            expect.assertions(3);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce(tokenResponse({ refresh_token: "rotated-token" })).mockResolvedValueOnce(sendResponse);

            const rejections: unknown[] = [];
            const onUnhandled = (reason: unknown): void => {
                rejections.push(reason);
            };

            process.on("unhandledRejection", onUnhandled);

            const error = vi.fn();
            const provider = outlook365Provider({
                clientId: "client-id",
                logger: { ...console, error } as unknown as Console,
                onRefreshToken: () => Promise.reject(new Error("disk write failed")),
                refreshToken: "original-token",
                tenantId: "tenant-id",
            });

            const result = await provider.sendEmail(email);

            await new Promise((resolve) => {
                setTimeout(resolve, 10);
            });

            process.off("unhandledRejection", onUnhandled);

            // The access token is valid, so the send must still succeed...
            expect(result.success).toBe(true);
            // ...the failure must be reported...
            expect(error.mock.calls[0][0]).toContain("disk write failed");
            // ...and must never escape as an unhandled rejection.
            expect(rejections).toStrictEqual([]);
        });

        it("surfaces the OAuth2 error description when the token request fails", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({
                data: { body: { error: "invalid_client", error_description: "AADSTS7000215: Invalid client secret provided." }, statusCode: 401 },
                success: false,
            });

            const result = await outlook365Provider(appOnlyConfig).sendEmail(email);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("AADSTS7000215");
        });

        it("reports a non-JSON token response", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({ data: { body: "<html>gateway</html>", statusCode: 200 }, success: true });

            const result = await outlook365Provider(appOnlyConfig).sendEmail(email);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("non-JSON response");
        });

        it("reports a token response with no access_token", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({ data: { body: { token_type: "Bearer" }, statusCode: 200 }, success: true });

            const result = await outlook365Provider(appOnlyConfig).sendEmail(email);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("did not contain an access_token");
        });

        it("reports a transport failure that carries no parseable body", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce({ error: new Error("socket hang up"), success: false });

            const result = await outlook365Provider(appOnlyConfig).sendEmail(email);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("socket hang up");
        });

        it("validates credentials by acquiring a token", async () => {
            expect.assertions(2);

            const makeRequestMock = makeRequest as ReturnType<typeof vi.fn>;

            makeRequestMock.mockResolvedValueOnce(tokenResponse());

            await expect(outlook365Provider(appOnlyConfig).validateCredentials()).resolves.toBe(true);

            makeRequestMock.mockResolvedValueOnce({ data: { body: { error: "invalid_client" }, statusCode: 401 }, success: false });

            await expect(outlook365Provider(appOnlyConfig).validateCredentials()).resolves.toBe(false);
        });

        it("keeps credentials out of the publicly readable options", () => {
            expect.assertions(2);

            const provider = outlook365Provider({ ...appOnlyConfig, refreshToken: "rt" });

            expect(provider.options).not.toHaveProperty("clientSecret");
            expect(provider.options).toMatchObject({ authMode: "refreshToken", clientId: "client-id", tenantId: "tenant-id" });
        });
    });
});
