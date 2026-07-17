import type { CacheableToken } from "../utils/create-token-cache";
import createTokenCache from "../utils/create-token-cache";
import headersToRecord from "../utils/headers-to-record";
import type { Middleware } from "./types";

/**
 * An OAuth2 access token plus its expiry.
 */
export type OAuth2Token = CacheableToken;

/**
 * Options for the {@link oauth2Middleware}.
 */
export interface OAuth2MiddlewareOptions {
    /**
     * Fetches (or refreshes) the access token. Called only when the cached token is missing or within
     * {@link OAuth2MiddlewareOptions.skewMs} of expiry. Wire this to your Gmail / Microsoft 365 refresh
     * flow.
     */
    fetchToken: () => Promise<OAuth2Token> | OAuth2Token;

    /**
     * The header to inject the credential into.
     * @default "Authorization"
     */
    headerName?: string;

    /**
     * Time source in milliseconds — injectable for tests. Defaults to `Date.now`.
     */
    now?: () => number;

    /**
     * Receives every freshly-acquired token — use it to feed SMTP XOAUTH2 or a provider client that
     * authenticates outside the message headers.
     * @param token The new token.
     */
    onToken?: (token: OAuth2Token) => void;

    /**
     * The auth scheme prefix for the header value.
     * @default "Bearer"
     */
    scheme?: string;

    /**
     * Refresh this many milliseconds before the token actually expires.
     * @default 60000
     */
    skewMs?: number;
}

/**
 * Injects an OAuth2 bearer credential into each outgoing message, refreshing it on demand and caching
 * it until just before expiry.
 *
 * Supplies the token to provider clients (Gmail, Microsoft 365) either via a request header or the
 * {@link OAuth2MiddlewareOptions.onToken} callback (for SMTP XOAUTH2).
 * @param options OAuth2 configuration. See {@link OAuth2MiddlewareOptions}.
 * @returns The middleware.
 */
export const oauth2Middleware = (options: OAuth2MiddlewareOptions): Middleware => {
    const { fetchToken, headerName = "Authorization", now = Date.now, onToken, scheme = "Bearer", skewMs = 60_000 } = options;

    const getToken = createTokenCache(async () => {
        const token = await fetchToken();

        onToken?.(token);

        return token;
    }, { now, skewMs });

    return async (emailOptions, next) => {
        const token = await getToken();

        const headers = emailOptions.headers ? headersToRecord(emailOptions.headers) : {};

        return next({
            ...emailOptions,
            headers: {
                ...headers,
                [headerName]: `${scheme} ${token.accessToken}`,
            },
        });
    };
};
