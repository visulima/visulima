import { RE_FAST_ANSI } from "../constants";
import LRUCache from "../utils/lru-cache";
import lowerFirst from "./lower-first";
import { splitByCase } from "./split-by-case";
import type { CamelCase, CaseOptions } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import joinSegments from "./utils/join-segments";
import normalizeGermanEszett from "./utils/normalize-german-eszett";

const defaultCacheStore = new LRUCache<string, string>(1000);

/**
 * Converts a string to camelCase.
 * @param value The string to convert.
 * @param options Options for case conversion.
 * @returns The string in camelCase.
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

const camelCase = <T extends string = string>(value?: T, options?: CaseOptions): CamelCase<T> => {
    if (typeof value !== "string" || !value) {
        return "";
    }

    const shouldCache = options?.cache ?? false;
    const cacheStore = options?.cacheStore ?? defaultCacheStore;
    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey && cacheStore.has(cacheKey)) {
        return cacheStore.get(cacheKey) as CamelCase<T>;
    }

    let firstWord = true;

    const result = joinSegments(
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
            if (options?.handleAnsi && RE_FAST_ANSI.test(word)) {
                return word;
            }

            const normalized = options?.locale?.startsWith("de") ? normalizeGermanEszett(word) : word;

            const lowered = options?.locale ? normalized.toLocaleLowerCase(options.locale) : normalized.toLowerCase();

            if (firstWord) {
                firstWord = false;

                return lowerFirst(lowered, options);
            }

            return upperFirst(lowered, options);
        }),
        "",
    );

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        cacheStore.set(cacheKey, result);
    }

    return result;
};

export default camelCase;
