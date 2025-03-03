import noCase from "./no-case";
import type { CapitalCase, CaseOptions } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import manageCache from "./utils/manage-cache";

// Cache for frequently used capital case conversions
const capitalCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Converts a string to Capital Case.
 * @example
 * ```typescript
 * capitalCase("foo bar") // => "Foo Bar"
 * capitalCase("foo-bar") // => "Foo Bar"
 * capitalCase("foo_bar") // => "Foo Bar"
 * capitalCase("XMLHttpRequest") // => "Xml Http Request"
 * capitalCase("AJAXRequest") // => "Ajax Request"
 * capitalCase("QueryXML123String") // => "Query Xml 123 String"
 * ```
 */
const capitalCase = <T extends string = string>(value?: T, options?: CaseOptions): CapitalCase<T> => {
    if (typeof value !== "string") {
        return "" as CapitalCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? capitalCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached as CapitalCase<T>;
        }
    }

    const words = noCase(value, { ...options, cache: false }).split(" ");
    const result = words.map((word) => upperFirst(word, { locale: options?.locale })).join(" ") as CapitalCase<T>;

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};

export default capitalCase;
