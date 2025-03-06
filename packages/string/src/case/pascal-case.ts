import { splitByCase } from "./split-by-case";
import type { CaseOptions, PascalCase } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import { joinSegments } from "./utils/join-segments";
import manageCache from "./utils/manage-cache";
import { normalizeGermanEszett } from "./utils/normalize-german-eszett";
import { FAST_ANSI_REGEX } from "./utils/regex";

// Cache for frequently used pascal case conversions
const pascalCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Converts a string to PascalCase.
 *
 * @param value - The string to convert.
 * @param options - Options for case conversion.
 * @returns The string in PascalCase.
 *
 * @example
 * ```typescript
 * pascalCase('foo bar') // 'FooBar'
 * pascalCase('foo-bar') // 'FooBar'
 * pascalCase('foo_bar') // 'FooBar'
 * pascalCase('XMLHttpRequest') // 'XmlHttpRequest'
 * pascalCase('AJAXRequest') // 'AjaxRequest'
 * pascalCase('QueryXML123String') // 'QueryXml123String'
 * ```
 */
const pascalCase = <T extends string = string>(value?: T, options?: CaseOptions): PascalCase<T> => {
    if (typeof value !== "string" || !value) {
        return "" as PascalCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? pascalCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached as PascalCase<T>;
        }
    }

    const result = joinSegments<PascalCase<T>>(
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

            const split = options?.locale?.startsWith("de") ? normalizeGermanEszett(word) : word;

            return upperFirst(options?.locale ? split.toLocaleLowerCase(options.locale) : split.toLowerCase(), { locale: options?.locale });
        }),
        "",
    );

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};

export default pascalCase;
