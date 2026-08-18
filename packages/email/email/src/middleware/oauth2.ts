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
     * Inject the credential into this **message** header.
     *
     * `EmailOptions.headers` are MIME headers written onto the outgoing message (see
     * `buildMimeMessage`), so every recipient — and every hop — sees this value. Providers
     * authenticate over their own transport (`apiKey` in the HTTP request, SMTP XOAUTH2), never
     * from here, so there is no legitimate reason to set this to `Authorization`.
     *
     * Leave it unset unless a provider genuinely requires a custom credential header on the
     * message itself. Use {@link OAuth2MiddlewareOptions.onToken} instead.
     * @default undefined — no header is injected
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
 * Acquires an OAuth2 credential for each outgoing message, refreshing it on demand and caching it
 * until just before expiry.
 *
 * The token is handed to the caller through {@link OAuth2MiddlewareOptions.onToken} — the channel
 * provider clients (Gmail, Microsoft 365, SMTP XOAUTH2) authenticate from. It is **not** written
 * onto the message unless {@link OAuth2MiddlewareOptions.headerName} is set explicitly, because
 * `EmailOptions.headers` are MIME headers the recipient can read.
 * @param options OAuth2 configuration. See {@link OAuth2MiddlewareOptions}.
 * @returns The middleware.
 * @throws {TypeError} If neither `onToken` nor `headerName` is supplied — the token would have
 * nowhere to go and the middleware would silently do nothing but burn token-endpoint calls — or if
 * `headerName` is empty.
 */
export const oauth2Middleware = (options: OAuth2MiddlewareOptions): Middleware => {
    const { fetchToken, headerName, now = Date.now, onToken, scheme = "Bearer", skewMs = 60_000 } = options;

    if (headerName?.trim() === "") {
        // An empty name passes the `undefined` check below and then reaches MIME construction as a
        // nameless field.
        throw new TypeError("oauth2Middleware: `headerName` must be a non-empty header name.");
    }

    if (onToken === undefined && headerName === undefined) {
        throw new TypeError("oauth2Middleware: supply `onToken` to receive the token (recommended), or `headerName` to inject it into a message header.");
    }

    const getToken = createTokenCache(async () => {
        const token = await fetchToken();

        onToken?.(token);

        return token;
    }, { now, skewMs });

    return async (emailOptions, next) => {
        const token = await getToken();

        if (headerName === undefined) {
            return next(emailOptions);
        }

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
