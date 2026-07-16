import type { BaseConfig, EmailOptions, MaybePromise } from "../../types";

/**
 * Which OAuth2 flow a config resolves to.
 */
export type Outlook365AuthMode = "accessToken" | "clientCredentials" | "getAccessToken" | "refreshToken";

/**
 * Outlook365 / Microsoft Graph configuration.
 *
 * Four authentication modes are supported, in precedence order:
 *
 * 1. `getAccessToken` — bring your own async token source (e.g. `@azure/msal-node`).
 * 2. `accessToken` — a static token, for scripts and tests.
 * 3. `refreshToken` — delegated flow; the provider exchanges the refresh token for access tokens and caches them. Requires `tenantId` + `clientId`.
 * 4. `clientSecret` — app-only flow (client credentials). Requires `tenantId` + `clientId`, and `userId` must name a real mailbox, since app-only tokens have no `me`.
 *
 * A confidential-client delegated config and an app-only config with a leftover `refreshToken`
 * are indistinguishable — both carry `tenantId`, `clientId`, `clientSecret` and `refreshToken`.
 * Set {@link Outlook365Config.authMode} to pin the flow when both are present.
 *
 * The built-in flows talk to the Azure AD token endpoint over `fetch` — no auth SDK is
 * bundled, so the provider stays dependency-light and runtime-agnostic.
 */
export interface Outlook365Config extends BaseConfig {
    /**
     * A static OAuth2 access token with the `Mail.Send` scope. Prefer
     * {@link Outlook365Config.getAccessToken} for tokens that expire.
     */
    accessToken?: string;

    /**
     * Pins the authentication flow instead of inferring it from which credentials are present.
     * Use it when a config could match more than one flow — most notably `clientCredentials`
     * vs `refreshToken` when both a client secret and a refresh token are supplied.
     */
    authMode?: Outlook365AuthMode;

    /**
     * Azure AD login authority (default `https://login.microsoftonline.com`). Override for
     * sovereign clouds, e.g. `https://login.microsoftonline.us`.
     */
    authority?: string;

    /**
     * Application (client) id of the Azure AD app registration. Required by the
     * `refreshToken` and `clientSecret` flows.
     */
    clientId?: string;

    /**
     * Client secret of the Azure AD app registration. Supplying this without a
     * {@link Outlook365Config.refreshToken} selects the app-only (client credentials) flow.
     * It is also sent with the delegated flow when the app is a confidential client.
     */
    clientSecret?: string;

    /**
     * API endpoint override (default `https://graph.microsoft.com/v1.0`).
     */
    endpoint?: string;

    /**
     * Returns a fresh OAuth2 access token with the `Mail.Send` scope.
     */
    getAccessToken?: () => MaybePromise<string>;

    /**
     * Time source in milliseconds — injectable for tests. Defaults to `Date.now`.
     */
    now?: () => number;

    /**
     * Called whenever Azure AD rotates the refresh token, so it can be persisted. Awaited
     * before the access token is handed out, so a rejected promise is reported rather than
     * surfacing as an unhandled rejection.
     *
     * The rotated token is adopted in-process regardless of whether persisting succeeds — the
     * previous token is already dead at Azure AD, so the new one is the only usable value. A
     * persist failure is logged rather than failing the send, but the stored token is then
     * stale and sending will break on restart.
     * @param refreshToken The new refresh token.
     */
    onRefreshToken?: (refreshToken: string) => MaybePromise<void>;

    /**
     * A long-lived OAuth2 refresh token, selecting the delegated flow. Obtain it via the
     * authorization-code flow with the `offline_access` scope.
     */
    refreshToken?: string;

    /**
     * Whether to keep a copy in the Sent Items folder (default true).
     */
    saveToSentItems?: boolean;

    /**
     * Scope override for the built-in flows. Defaults to
     * `["https://graph.microsoft.com/.default"]` for the app-only flow and
     * `["https://graph.microsoft.com/Mail.Send", "offline_access"]` for the delegated flow.
     */
    scopes?: string[];

    /**
     * Azure AD tenant id (or `common` / `organizations` for the delegated flow). Required by
     * the `refreshToken` and `clientSecret` flows.
     */
    tenantId?: string;

    /**
     * Renew the access token this many milliseconds before it expires (default 60000).
     * Negative values are clamped to 0. A value larger than the token lifetime disables
     * caching, costing one token request per send.
     */
    tokenRefreshSkewMs?: number;

    /**
     * The mailbox to send as: a user id/UPN. Defaults to `me` (the token's own mailbox).
     * The app-only flow has no `me`, so it requires an explicit value.
     */
    userId?: string;
}

/**
 * Outlook365-specific email options.
 */
export interface Outlook365EmailOptions extends EmailOptions {
    /**
     * Message importance.
     */
    importance?: "high" | "low" | "normal";
}
