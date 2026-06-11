/**
 * Shared OAuth refresh-token helper for consumer-cloud adapters (Dropbox,
 * OneDrive, …). Caches the access token until ~60s before expiry and
 * exchanges the refresh token at the provider's token endpoint on cache miss.
 *
 * Adapters customize the token URL and the form body. The `onRefresh` hook
 * lets adapters propagate the new token into a native SDK that owns its own
 * `Authorization` header (e.g. the Dropbox SDK).
 */

const DEFAULT_LEEWAY_MS = 60_000;

interface OAuthTokenResponse {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
}

export interface OAuthRefreshHandle {
    getAccessToken: () => Promise<string>;
}

export interface CreateOAuthRefreshOptions {
    /**
     * Build the `application/x-www-form-urlencoded` body for each refresh
     * request. Called on every cache miss; should be a pure function so the
     * adapter can pass long-lived secrets via closure.
     */
    buildBody: () => URLSearchParams;

    /**
     * Leeway before token expiry, in milliseconds. Defaults to 60_000 (60s) —
     * the largest value that fits comfortably inside Microsoft Graph,
     * Dropbox, and Box token lifetimes.
     */
    leewayMs?: number;

    /**
     * Optional hook invoked after a successful refresh — receives the new
     * access token. Adapters whose SDK owns its own Authorization header
     * (e.g. Dropbox) use this to keep the SDK in sync.
     */
    onRefresh?: (accessToken: string) => void;

    /**
     * Optional hook invoked after a successful refresh when the provider returns
     * a rotated `refresh_token`. Box and Dropbox rotate refresh tokens (one-time
     * use); adapters must persist the new value or subsequent refreshes will fail
     * once the old token is invalidated. Receives the new refresh token.
     */
    onRefreshToken?: (refreshToken: string) => void;

    /**
     * Provider name for error messages (e.g. `"Dropbox"`, `"OneDrive"`).
     * Surfaces as the prefix on every thrown error.
     */
    provider: string;

    /**
     * Token endpoint URL. The helper does no per-request escaping — pass a
     * fully-encoded URL.
     */
    tokenUrl: string;
}

export const createOAuthRefreshHandle = (options: CreateOAuthRefreshOptions): OAuthRefreshHandle => {
    let cached: { expiresOnMs: number; token: string } | undefined;
    // Single-flight guard: N concurrent cache-miss callers share one in-flight token exchange
    // instead of each firing its own POST (which wastes quota and, with rotating refresh tokens,
    // races to invalidate each other's tokens).
    let inFlight: Promise<string> | undefined;
    const leewayMs = options.leewayMs ?? DEFAULT_LEEWAY_MS;

    const exchange = async (): Promise<string> => {
        const now = Date.now();

        const response = await fetch(options.tokenUrl, {
            body: options.buildBody(),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            method: "POST",
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");

            throw new Error(`${options.provider}: token exchange failed (${response.status}): ${text || response.statusText}`);
        }

        const json = (await response.json()) as OAuthTokenResponse;

        if (!json.access_token) {
            throw new Error(`${options.provider}: token response missing access_token`);
        }

        cached = {
            expiresOnMs: now + (json.expires_in ?? 3600) * 1000,
            token: json.access_token,
        };

        options.onRefresh?.(json.access_token);

        // Box/Dropbox rotate refresh tokens (one-time use): surface the new value so the adapter
        // can persist it, otherwise the next refresh fails once the old token is invalidated.
        if (json.refresh_token) {
            options.onRefreshToken?.(json.refresh_token);
        }

        return json.access_token;
    };

    const refresh = async (): Promise<string> => {
        if (cached && cached.expiresOnMs - leewayMs > Date.now()) {
            return cached.token;
        }

        if (inFlight) {
            return inFlight;
        }

        inFlight = exchange().finally(() => {
            inFlight = undefined;
        });

        return inFlight;
    };

    return { getAccessToken: refresh };
};
