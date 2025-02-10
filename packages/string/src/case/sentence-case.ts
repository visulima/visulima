import { noCase } from "./no-case";
import type { CaseOptions, SentenceCase } from "./types";
import { upperFirst } from "./upper-first";
import { generateCacheKey } from "./utils/generate-cache-key";
import { manageCache } from "./utils/manage-cache";

// Cache for frequently used sentence case conversions
const sentenceCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Converts a string to Sentence case.
 * @example
 * ```typescript
 * sentenceCase("foo bar") // => "Foo bar"
 * sentenceCase("foo-bar") // => "Foo bar"
 * sentenceCase("foo_bar") // => "Foo bar"
 * sentenceCase("XMLHttpRequest") // => "Xml http request"
 * sentenceCase("AJAXRequest") // => "Ajax request"
 * sentenceCase("QueryXML123String") // => "Query xml 123 string"
 * ```
 */
export const sentenceCase = <T extends string = string>(value?: T, options?: CaseOptions): SentenceCase<T> => {
    if (typeof value !== "string") {
        return "" as SentenceCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? sentenceCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached as SentenceCase<T>;
        }
    }

    const words = noCase(value, { ...options, cache: false });
    const result = upperFirst(words, { ...options }) as SentenceCase<T>;

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};
