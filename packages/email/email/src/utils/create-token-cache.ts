/**
 * A token that may carry an absolute expiry.
 */
interface CacheableToken {
    /**
     * The bearer access token.
     */
    accessToken: string;

    /**
     * Absolute expiry time in milliseconds since the epoch. Omit for non-expiring tokens.
     */
    expiresAt?: number;
}

/**
 * Options for {@link createTokenCache}.
 */
interface TokenCacheOptions {
    /**
     * Time source in milliseconds — injectable for tests.
     * @default Date.now
     */
    now?: () => number;

    /**
     * Refresh this many milliseconds before the token actually expires.
     * @default 60000
     */
    skewMs?: number;
}

const DEFAULT_SKEW_MS = 60_000;

/**
 * Wraps a token fetcher with caching: the token is reused until `skewMs` before it expires, and
 * concurrent callers during a refresh share one in-flight request rather than stampeding the
 * token endpoint.
 *
 * A failed fetch is never cached, and rejects every waiter of that attempt — the next call
 * retries from scratch.
 * @param fetchToken Acquires (or renews) the token.
 * @param options Cache configuration. See {@link TokenCacheOptions}.
 * @returns A function returning a valid token.
 */
const createTokenCache = <T extends CacheableToken>(fetchToken: () => Promise<T>, options: TokenCacheOptions = {}): () => Promise<T> => {
    const { now = Date.now, skewMs = DEFAULT_SKEW_MS } = options;

    // A negative skew would hand out tokens past their expiry.
    const effectiveSkewMs = Math.max(0, skewMs);

    let cached: T | undefined;
    let pending: Promise<T> | undefined;

    const isFresh = (token: T): boolean => token.expiresAt === undefined || token.expiresAt - effectiveSkewMs > now();

    return async (): Promise<T> => {
        if (cached && isFresh(cached)) {
            return cached;
        }

        // Collapse a burst of concurrent callers into one fetch. `cached` is only assigned on
        // success, so a failed refresh cannot poison the cache; `finally` clears `pending` on
        // both paths, so the next call retries.
        pending ??= fetchToken()
            .then((token) => {
                cached = token;

                return token;
            })
            .finally(() => {
                pending = undefined;
            });

        const token = await pending;

        return token;
    };
};

export type { CacheableToken, TokenCacheOptions };
export default createTokenCache;
