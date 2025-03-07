import { splitByCase } from "./split-by-case";
import type { CaseOptions, SentenceCase } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import joinSegments from "./utils/join-segments";
import manageCache from "./utils/manage-cache";
import { normalizeGermanEszett } from "./utils/normalize-german-eszett";
import { FAST_ANSI_REGEX } from "./utils/regex";

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
const sentenceCase = <T extends string = string>(value?: T, options?: CaseOptions): SentenceCase<T> => {
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

    let firstWord = true;

    const result = joinSegments<SentenceCase<T>>(
        splitByCase(value, {
            handleAnsi: options?.handleAnsi,
            handleEmoji: options?.handleEmoji,
            knownAcronyms: options?.knownAcronyms,
            locale: options?.locale,
            normalize: options?.normalize,
            separators: undefined,
            stripAnsi: options?.stripAnsi,
            stripEmoji: options?.stripEmoji,
        }).map((word: string) => {
            if (!options?.stripEmoji && FAST_ANSI_REGEX.test(word)) {
                return word;
            }

            word = options?.locale?.startsWith("de") ? normalizeGermanEszett(word) : word;
            word = options?.locale ? word.toLocaleLowerCase(options.locale) : word.toLowerCase();

            if (firstWord) {
                firstWord = false;

                return upperFirst(word, options);
            }

            return word;
        }),
        " ",
    );

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};

export default sentenceCase;
