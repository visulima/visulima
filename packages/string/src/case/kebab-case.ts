import { RE_FAST_ANSI } from "../constants";
import LRUCache from "../utils/lru-cache";
import { splitByCase } from "./split-by-case";
import type { CaseOptions, KebabCase } from "./types";
import generateCacheKey from "./utils/generate-cache-key";
import joinSegments from "./utils/join-segments";
import normalizeGermanEszett from "./utils/normalize-german-eszett";

const defaultCacheStore = new LRUCache<string, string>(1000);

export interface KebabCaseOptions extends CaseOptions {
    /**
     * The string to use as a joiner between words.
     * @default "-"
     */
    joiner?: string;

    /**
     * Whether to convert the result to uppercase.
     * @default false
     */
    toUpperCase?: boolean;
}

// eslint-disable-next-line no-secrets/no-secrets
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
// eslint-disable-next-line sonarjs/cognitive-complexity
export const kebabCase = <T extends string = string>(value?: T, options?: KebabCaseOptions): KebabCase<T> => {
    if (typeof value !== "string") {
        return "" as KebabCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheStore = options?.cacheStore ?? defaultCacheStore;
    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey && cacheStore.has(cacheKey)) {
        return cacheStore.get(cacheKey) as KebabCase<T>;
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
        if (options?.handleAnsi && RE_FAST_ANSI.test(word)) {
            return word;
        }

        if (options?.toUpperCase) {
            if (options.locale) {
                return word.toLocaleUpperCase(options.locale);
            }

            return word.toUpperCase();
        }

        const split = options?.locale?.startsWith("de") ? normalizeGermanEszett(word) : word;

        if (options?.locale) {
            return split.toLocaleLowerCase(options.locale);
        }

        return split.toLowerCase();
    });

    // Join the processed words with proper handling of ANSI and emoji sequences
    const result = joinSegments<KebabCase<T>>(processed, options?.joiner ?? "-");

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        cacheStore.set(cacheKey, result);
    }

    return result;
};
