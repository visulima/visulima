import { RE_FAST_ANSI } from "../constants";
import LRUCache from "../utils/lru-cache";
import { splitByCase } from "./split-by-case";
import type { CapitalCase, CaseOptions } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import joinSegments from "./utils/join-segments";
import normalizeGermanEszett from "./utils/normalize-german-eszett";

const defaultCacheStore = new LRUCache<string, string>(1000);

// eslint-disable-next-line no-secrets/no-secrets
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
    const cacheStore = options?.cacheStore ?? defaultCacheStore;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    if (shouldCache && cacheKey && cacheStore.has(cacheKey)) {
        return cacheStore.get(cacheKey) as CapitalCase<T>;
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
        if (RE_FAST_ANSI.test(word)) {
            return word;
        }

        const split = options?.locale?.startsWith("de") ? normalizeGermanEszett(word) : word;

        return upperFirst(options?.locale ? split.toLocaleLowerCase(options.locale) : split.toLocaleLowerCase(), options);
    });

    const result = joinSegments<CapitalCase<T>>(processed, " ");

    if (shouldCache && cacheKey) {
        cacheStore.set(cacheKey, result);
    }

    return result;
};

export default capitalCase;
