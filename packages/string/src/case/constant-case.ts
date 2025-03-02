import snakeCase from "./snake-case";
import type { CaseOptions, ConstantCase } from "./types";
import generateCacheKey from "./utils/generate-cache-key";
import manageCache from "./utils/manage-cache";

// Cache for frequently used constant case conversions
const constantCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

// eslint-disable-next-line no-secrets/no-secrets
/**
 * Converts a string to CONSTANT_CASE.
 * @example
 * ```typescript
 * constantCase("foo bar") // => "FOO_BAR"
 * constantCase("foo-bar") // => "FOO_BAR"
 * constantCase("foo_bar") // => "FOO_BAR"
 * constantCase("XMLHttpRequest") // => "XML_HTTP_REQUEST"
 * constantCase("AJAXRequest") // => "AJAX_REQUEST"
 * constantCase("QueryXML123String") // => "QUERY_XML_123_STRING"
 * ```
 */
const constantCase = <T extends string = string>(value?: T, options?: CaseOptions): ConstantCase<T> => {
    if (typeof value !== "string") {
        return "" as ConstantCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? constantCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached as ConstantCase<T>;
        }
    }

    const snakeResult = snakeCase(value, { ...options, cache: false });
    const result = (options?.locale ? snakeResult.toLocaleUpperCase(options.locale) : snakeResult.toUpperCase()) as ConstantCase<T>;

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};

export default constantCase;
