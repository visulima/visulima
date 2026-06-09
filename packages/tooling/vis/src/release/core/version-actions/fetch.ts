/**
 * Shared fetch helper for registry-detection calls.
 *
 * Two responsibilities, both audit-driven:
 *
 *   - **SSRF guard (M-4)** — Node's built-in `fetch` follows up to 20
 *     redirects automatically. A user-configurable URL (especially
 *     `maven.mavenMetadataUrl`) can therefore be coerced into hitting
 *     internal hosts (169.254.169.254 cloud-metadata, intranet
 *     services, etc.). We pass `redirect: "manual"` to opt out of
 *     automatic following and then manually walk up to 2 redirects
 *     ourselves — but ONLY when the redirect target is on the same
 *     host as the original URL. Cross-host redirects are treated as a
 *     404 (returns `undefined`), which the caller already handles as
 *     "publish anyway" / "unknown".
 *
 *   - **User-Agent (B-3)** — crates.io and PyPI explicitly request a
 *     contact UA. We stamp every registry-detection request with
 *     `vis-release/&lt;version> (+homepage)` so registry operators can
 *     attribute traffic spikes. The version is read from this
 *     package's `package.json` once (cached) so we don't repeatedly
 *     touch disk.
 *
 * Errors / non-2xx without same-host redirect / cross-host redirect
 * all surface as `{ ok: false, status: &lt;responseStatus or 0> }` to the
 * caller, who decides what's recoverable. This module never throws —
 * the entire point of these probes is "fail-open, publish anyway".
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cached User-Agent string. We compute this lazily on the first call
 * so test runs don't fight a non-existent `package.json` lookup, and
 * so the cost is paid exactly once per process.
 */
let cachedUserAgent: string | undefined;

const VIS_HOMEPAGE = "https://github.com/visulima/visulima";

/**
 * Resolve `&lt;vis-package-root>/package.json` and read its `version`
 * field. Falls back to `"unknown"` when the lookup fails — a missing
 * version doesn't justify aborting the whole publish probe.
 */
const resolveVersion = async (): Promise<string> => {
    try {
        // Walk up from this file's directory until we find a
        // package.json carrying the `@visulima/vis` name. The build
        // copies this module into `dist/`, so we can't hard-code a
        // fixed depth — walk up at most 6 levels and stop on first
        // match.
        const here = dirname(fileURLToPath(import.meta.url));
        let cursor = here;

        for (let index = 0; index < 6; index += 1) {
            const candidate = join(cursor, "package.json");

            try {
                const raw = await readFile(candidate, "utf8");
                const parsed = JSON.parse(raw) as { name?: string; version?: string };

                if (parsed.name === "@visulima/vis" && typeof parsed.version === "string") {
                    return parsed.version;
                }
            } catch {
                // Not this directory — keep walking.
            }

            const parent = dirname(cursor);

            if (parent === cursor) {
                break;
            }

            cursor = parent;
        }
    } catch {
        // Filesystem unreachable from this context — degrade gracefully.
    }

    return "unknown";
};

/**
 * Return the (lazily-computed) `User-Agent` header value.
 *
 * Format: `vis-release/&lt;version> (+&lt;homepage>)` — mirrors what other
 * release tools (semantic-release, changesets) emit and matches what
 * crates.io's policy page asks for.
 */
export const getUserAgent = async (): Promise<string> => {
    if (cachedUserAgent !== undefined) {
        return cachedUserAgent;
    }

    const version = await resolveVersion();

    cachedUserAgent = `vis-release/${version} (+${VIS_HOMEPAGE})`;

    return cachedUserAgent;
};

/**
 * Synchronous accessor — returns the cached UA if available, else a
 * sensible fallback. Used in the rare case a caller can't await
 * (e.g. inside a synchronous header-construction block). Prefer
 * {@link getUserAgent} where possible.
 */
export const getUserAgentSync = (): string => cachedUserAgent ?? `vis-release/unknown (+${VIS_HOMEPAGE})`;

/** Options accepted by {@link safeFetchVersionMetadata}. */
export interface SafeFetchOptions {
    /**
     * Hook used in tests to replace the underlying fetch. Reads
     * `globalThis.fetch` at call time when omitted so tests that stub
     * it via `vi.spyOn(globalThis, "fetch")` continue to work.
     */
    fetchImpl?: typeof globalThis.fetch;
    /** Additional request headers (merged with the auto-injected `User-Agent`). */
    headers?: Record<string, string>;

    /**
     * HTTPS proxy URL. When set, an undici `ProxyAgent` is constructed
     * and attached via the request's `dispatcher` option so Node's
     * built-in fetch routes through the proxy. Node 22 ships undici;
     * no external dep needed. Lazy import keeps the cost off the
     * happy path.
     */
    httpProxy?: string;

    /**
     * Maximum same-host redirects to follow. Default `2`. We cap it
     * deliberately low — registry CDNs may redirect once for path
     * normalisation, but anything beyond that is unusual.
     */
    maxRedirects?: number;
    /** HTTP method. Default `"GET"`. */
    method?: string;
}

/**
 * Cache of `ProxyAgent` instances keyed by URL. Each ProxyAgent owns a
 * connection pool, so we want one per unique proxy URL — not one per
 * request. Lazy-initialised on first use.
 */
const proxyAgentCache = new Map<string, unknown>();

/**
 * Resolve (and lazily construct) an undici ProxyAgent for the given
 * URL. Returns `undefined` when the agent can't be constructed for any
 * reason (undici unavailable on the runtime, malformed URL, …) so
 * callers fall back to direct fetch.
 */
const getProxyAgent = async (httpProxy: string): Promise<unknown> => {
    const cached = proxyAgentCache.get(httpProxy);

    if (cached !== undefined) {
        return cached;
    }

    try {
        // `undici` is a declared dependency (Node bundles it internally for
        // global fetch but does not expose the `"undici"` specifier to
        // userland). Lazily imported so the proxy machinery is only paid for
        // when an httpProxy is actually configured; still degrades gracefully
        // if resolution ever fails on an exotic runtime.
        const undici = await import("undici");
        const agent = new undici.ProxyAgent(httpProxy);

        proxyAgentCache.set(httpProxy, agent);

        return agent;
    } catch {
        return undefined;
    }
};

/** Test-only reset hook so suites don't leak ProxyAgent instances between cases. */
// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention -- test-only export seam
export const __resetProxyAgentCacheForTests = (): void => {
    proxyAgentCache.clear();
};

/**
 * Lightweight subset of the `Response` shape returned by
 * {@link safeFetchVersionMetadata}. We expose only what the callers
 * actually use so test stubs don't have to fake the full DOM
 * `Response` interface.
 */
export interface SafeFetchResponse {
    json: () => Promise<unknown>;
    ok: boolean;
    status: number;
    text: () => Promise<string>;
}

const isRedirectStatus = (status: number): boolean => status === 301 || status === 302 || status === 303 || status === 307 || status === 308;

const sameHost = (a: string, b: string): boolean => {
    try {
        const ua = new URL(a);
        const ub = new URL(b);

        // Same host AND same port — a redirect from `:443` to `:8080`
        // on the same hostname should still be treated as cross-origin
        // because the latter is almost certainly a different service.
        return ua.host === ub.host && ua.protocol === ub.protocol;
    } catch {
        return false;
    }
};

/**
 * SSRF-safe fetch for registry-detection. Always passes
 * `redirect: "manual"`. When the response is a 3xx, follows up to
 * `maxRedirects` same-host redirects manually. Cross-host redirects
 * are treated as a 404-equivalent (returns `{ ok: false, status: 0 }`).
 *
 * The auto-injected `User-Agent` can be overridden via `headers`.
 *
 * Never throws — wraps network errors into `{ ok: false, status: 0 }`.
 */
export const safeFetchVersionMetadata = async (
    url: string,
    options: SafeFetchOptions = {},
): Promise<SafeFetchResponse> => {
    const maxRedirects = options.maxRedirects ?? 2;
    const userAgent = await getUserAgent();
    const baseHeaders: Record<string, string> = {
        "User-Agent": userAgent,
        ...options.headers,
    };

    // `User-Agent` MUST win over operator-supplied headers iff the
    // operator didn't pass one explicitly — but if they did
    // (e.g. test override), respect it. The spread above already
    // honours that ordering when `headers` is supplied last.
    if (options.headers?.["User-Agent"]) {
        baseHeaders["User-Agent"] = options.headers["User-Agent"]!;
    }

    let currentUrl = url;
    let redirectsFollowed = 0;
    const dispatcher = options.httpProxy ? await getProxyAgent(options.httpProxy) : undefined;

    while (true) {
        let response: Response;

        try {
            const impl = options.fetchImpl ?? globalThis.fetch;
            // `dispatcher` is an undici-specific extension on Node's
            // global fetch — typed via `as` to avoid coupling the type
            // surface to undici. Drops cleanly when undefined.
            const init: RequestInit = {
                headers: baseHeaders,
                method: options.method ?? "GET",
                redirect: "manual",
            };

            if (dispatcher) {
                (init as RequestInit & { dispatcher?: unknown }).dispatcher = dispatcher;
            }

            response = await impl(currentUrl, init);
        } catch {
            // Network failure, DNS lookup error, abort — all
            // collapse to a single "unknown" status so the caller's
            // 404 / non-ok branch handles them uniformly.
            return {
                json: async () => undefined,
                ok: false,
                status: 0,
                text: async () => "",
            };
        }

        if (!isRedirectStatus(response.status)) {
            return {
                json: async (): Promise<unknown> => {
                    try {
                        return await response.json() as unknown;
                    } catch {
                        return undefined;
                    }
                },
                ok: response.ok,
                status: response.status,
                text: async () => {
                    try {
                        return await response.text();
                    } catch {
                        return "";
                    }
                },
            };
        }

        // We have a redirect. Pull the Location header; if missing or
        // if we've exceeded the budget, fail-open with status 0.
        const location = response.headers.get("location") ?? response.headers.get("Location");

        if (!location || redirectsFollowed >= maxRedirects) {
            return {
                json: async () => undefined,
                ok: false,
                status: 0,
                text: async () => "",
            };
        }

        // Resolve the redirect target relative to the current URL —
        // many servers emit relative Location headers.
        let resolved: string;

        try {
            resolved = new URL(location, currentUrl).toString();
        } catch {
            return {
                json: async () => undefined,
                ok: false,
                status: 0,
                text: async () => "",
            };
        }

        // Cross-host redirect → reject. This is the SSRF guard: we
        // refuse to follow a user-configurable URL onto a different
        // host because that host might be internal (link-local IPs,
        // intranet services, cloud metadata).
        if (!sameHost(url, resolved)) {
            return {
                json: async () => undefined,
                ok: false,
                status: 0,
                text: async () => "",
            };
        }

        currentUrl = resolved;
        redirectsFollowed += 1;
    }
};

// Test-only reset of the cached user-agent. Lets a test fixture verify
// that the first request stamps the expected header without leaking
// across test runs.
// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention -- test-only export seam
export const __resetUserAgentCacheForTests = (): void => {
    cachedUserAgent = undefined;
};
