import { splitByCase } from "./split-by-case";
import type { CapitalCase, CaseOptions } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import joinSegments from "./utils/join-segments";
import manageCache from "./utils/manage-cache";
import { normalizeGermanEszett } from "./utils/normalize-german-eszett";
import { FAST_ANSI_REGEX } from "./utils/regex";

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

    // Process each word - convert to lowercase and handle German eszett
    const processed = words.map((word) => {
        if (FAST_ANSI_REGEX.test(word)) {
            return word;
        }

        const split = options?.locale?.startsWith("de") ? normalizeGermanEszett(word) : word;

        return upperFirst(options?.locale ? split.toLocaleLowerCase(options.locale) : split.toLocaleLowerCase(), options);
    });

    // Join the processed words with proper handling of ANSI and emoji sequences
    const result = joinSegments<CapitalCase<T>>(processed, " ");

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};

export default capitalCase;
