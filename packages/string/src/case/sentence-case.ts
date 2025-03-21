import { RE_FAST_ANSI } from "../constants";
import LRUCache from "../utils/lru-cache";
import { splitByCase } from "./split-by-case";
import type { CaseOptions, SentenceCase } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import joinSegments from "./utils/join-segments";
import normalizeGermanEszett from "./utils/normalize-german-eszett";

const defaultCacheStore = new LRUCache<string, string>(1000);

// eslint-disable-next-line no-secrets/no-secrets
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
// eslint-disable-next-line sonarjs/cognitive-complexity
const sentenceCase = <T extends string = string>(value?: T, options?: CaseOptions): SentenceCase<T> => {
    if (typeof value !== "string") {
        return "" as SentenceCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheStore = options?.cacheStore ?? defaultCacheStore;
    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey && cacheStore.has(cacheKey)) {
        return cacheStore.get(cacheKey) as SentenceCase<T>;
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
            if (options?.handleAnsi && RE_FAST_ANSI.test(word)) {
                return word;
            }

            // eslint-disable-next-line no-param-reassign
            word = options?.locale?.startsWith("de") ? normalizeGermanEszett(word) : word;
            // eslint-disable-next-line no-param-reassign
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
        cacheStore.set(cacheKey, result);
    }

    return result;
};

export default sentenceCase;
