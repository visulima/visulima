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
    const leewayMs = options.leewayMs ?? DEFAULT_LEEWAY_MS;

    const refresh = async (): Promise<string> => {
        const now = Date.now();

        if (cached && cached.expiresOnMs - leewayMs > now) {
            return cached.token;
        }

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

        return json.access_token;
    };

    return { getAccessToken: refresh };
};
