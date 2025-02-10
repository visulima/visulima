import { splitByCase } from "./split-by-case";
import type { CaseOptions, TrainCase } from "./types";
import { upperFirst } from "./upper-first";
import { generateCacheKey } from "./utils/generate-cache-key";
import { manageCache } from "./utils/manage-cache";

// Cache for frequently used train case conversions
const trainCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Converts a string to Train-Case.
 * @example
 * ```typescript
 * trainCase("foo bar") // => "Foo-Bar"
 * trainCase("foo-bar") // => "Foo-Bar"
 * trainCase("foo_bar") // => "Foo-Bar"
 * trainCase("XMLHttpRequest") // => "XML-Http-Request"
 * trainCase("AJAXRequest") // => "AJAX-Request"
 * trainCase("QueryXML123String") // => "Query-XML-123-String"
 * ```
 */
export const trainCase = <T extends string = string>(value?: T, options?: CaseOptions): TrainCase<T> => {
    if (typeof value !== "string") {
        return "" as TrainCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? trainCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached as TrainCase<T>;
        }
    }

    const result = splitByCase(value, {
        handleAnsi: options?.handleAnsi,
        handleEmoji: options?.handleEmoji,
        knownAcronyms: options?.knownAcronyms,
        locale: options?.locale,
        normalize: options?.normalize,
        separators: undefined,
    })
        .filter(Boolean)
        .map((p) => upperFirst(p, { locale: options?.locale }))
        .join("-") as TrainCase<T>;

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};
