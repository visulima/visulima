import type { BaseConfig, EmailOptions, MaybePromise } from "../../types";

/**
 * Outlook365 / Microsoft Graph configuration.
 *
 * Authentication is delegated: supply a static `accessToken` or an async
 * `getAccessToken` (e.g. backed by `@azure/msal-node`). The provider never bundles an
 * auth SDK, so it stays dependency-light and runtime-agnostic.
 */
export interface Outlook365Config extends BaseConfig {
    /**
     * A static OAuth2 access token with the `Mail.Send` scope. Prefer
     * {@link Outlook365Config.getAccessToken} for tokens that expire.
     */
    accessToken?: string;

    /**
     * API endpoint override (default `https://graph.microsoft.com/v1.0`).
     */
    endpoint?: string;

    /**
     * Returns a fresh OAuth2 access token with the `Mail.Send` scope.
     */
    getAccessToken?: () => MaybePromise<string>;

    /**
     * Whether to keep a copy in the Sent Items folder (default true).
     */
    saveToSentItems?: boolean;

    /**
     * The mailbox to send as: a user id/UPN. Defaults to `me` (the token's own mailbox).
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
