import type { CaseOptions, FlipCase } from "./types";
import { generateCacheKey } from "./utils/generate-cache-key";
import { manageCache } from "./utils/manage-cache";
import { stripAnsi, stripEmoji } from "./utils/regex";

// Cache for frequently used flip case conversions
const flipCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Flips the case of each character in a string.
 * @example
 * ```typescript
 * flipCase("FooBar") // => "fOObAR"
 * flipCase("foobar") // => "FOOBAR"
 * flipCase("FOOBAR") // => "foobar"
 * flipCase("XMLHttpRequest") // => "xmlhTTPrEQUEST"
 * ```
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const flipCase = <T extends string = string>(value?: T, options?: CaseOptions): FlipCase<T> => {
    if (typeof value !== "string") {
        return "";
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? flipCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached;
        }
    }

    let cleanedInput = value;

    if (options?.stripAnsi) {
        cleanedInput = stripAnsi(cleanedInput) as T;
    }

    if (options?.stripEmoji) {
        cleanedInput = stripEmoji(cleanedInput) as T;
    }

    const result = cleanedInput
        // eslint-disable-next-line unicorn/prefer-spread
        .split("")
        .map((char) => {
            const lowerChar = options?.locale ? char.toLocaleLowerCase(options.locale) : char.toLowerCase();

            return char === lowerChar ? (options?.locale ? char.toLocaleUpperCase(options.locale) : char.toUpperCase()) : lowerChar;
        })
        .join("");

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};
