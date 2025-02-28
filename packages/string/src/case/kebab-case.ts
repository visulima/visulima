import { splitByCase } from "./split-by-case";
import type { CaseOptions, KebabCase } from "./types";
import { generateCacheKey } from "./utils/generate-cache-key";
import { manageCache } from "./utils/manage-cache";
import { normalizeGermanEszett } from "./utils/normalize-german-eszett";
import { toLowerCase } from "./utils/to-lower-case";

export interface KebabCaseOptions extends CaseOptions {
    /**
     * The string to use as a joiner between words.
     * @default "-"
     */
    joiner?: string;
}

/**
 * Converts a string to kebab-case.
 * @example
 * ```typescript
 * kebabCase("fooBar") // => "foo-bar"
 * kebabCase("foo bar") // => "foo-bar"
 * kebabCase("foo_bar") // => "foo-bar"
 * kebabCase("XMLHttpRequest") // => "xml-http-request"
 * kebabCase("AJAXRequest") // => "ajax-request"
 * kebabCase("QueryXML123String") // => "query-xml-123-string"
 * ```
 */
// Cache for frequently used kebab case conversions
const kebabCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

export const kebabCase = <T extends string = string>(value?: T, options?: KebabCaseOptions): KebabCase<T> => {
    if (typeof value !== "string") {
        return "" as KebabCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? kebabCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached as KebabCase<T>;
        }
    }

    const words = splitByCase(value, {
        handleAnsi: options?.handleAnsi,
        handleEmoji: options?.handleEmoji,
        knownAcronyms: options?.knownAcronyms,
        locale: options?.locale,
        normalize: options?.normalize,
        separators: undefined,
        stripAnsi: options?.stripAnsi,
        stripEmoji: options?.stripEmoji,
    });

    const processed = words.map((p) => {
        const split = options?.locale?.startsWith("de") ? normalizeGermanEszett(p) : p;

        return toLowerCase(split, options?.locale);
    });

    const result = processed.join(options?.joiner ?? "-") as KebabCase<T>;

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};
