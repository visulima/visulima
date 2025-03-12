import lowerFirst from "./lower-first";
import { splitByCase } from "./split-by-case";
import type { CamelCase, CaseOptions } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import joinSegments from "./utils/join-segments";
import manageCache from "./utils/manage-cache";
import normalizeGermanEszett from "./utils/normalize-german-eszett";
import { FAST_ANSI_REGEX } from "./utils/regex";

// Cache for frequently used camel case conversions
const camelCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

// eslint-disable-next-line no-secrets/no-secrets
/**
 * Converts a string to camelCase.
 *
 * @param value - The string to convert.
 * @param options - Options for case conversion.
 * @returns The string in camelCase.
 *
 * @example
 * ```typescript
 * camelCase('foo bar') // 'fooBar'
 * camelCase('foo-bar') // 'fooBar'
 * camelCase('foo_bar') // 'fooBar'
 * camelCase('XMLHttpRequest') // 'xmlHttpRequest'
 * camelCase('AJAXRequest') // 'ajaxRequest'
 * camelCase('QueryXML123String') // 'queryXml123String'
 * ```
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const camelCase = <T extends string = string>(value?: T, options?: CaseOptions): CamelCase<T> => {
    if (typeof value !== "string" || !value) {
        return "" as CamelCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? camelCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached as CamelCase<T>;
        }
    }

    let firstWord = true;

    const result = joinSegments<CamelCase<T>>(
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

            // eslint-disable-next-line no-param-reassign
            word = options?.locale?.startsWith("de") ? normalizeGermanEszett(word) : word;
            // eslint-disable-next-line no-param-reassign
            word = options?.locale ? word.toLocaleLowerCase(options.locale) : word.toLowerCase();

            if (firstWord) {
                firstWord = false;

                return lowerFirst(word, options);
            }

            return upperFirst(word, options);
        }),
        "",
    );

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};

export default camelCase;
