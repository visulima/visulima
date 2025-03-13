// @ts-expect-error: TODO: find why this typing is not working
import { stripVTControlCharacters } from "node:util";

import { stripEmoji } from "../constants";
import type { CaseOptions, FlipCase } from "./types";
import generateCacheKey from "./utils/generate-cache-key";
import manageCache from "./utils/manage-cache";

// Cache for frequently used flip case conversions
const flipCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Options specific to flip case operations.
 * @note handleEmoji is not needed as the function preserves emojis by default
 */
export type FlipOptions = Omit<CaseOptions, "handleEmoji">;

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
export const flipCase = <T extends string = string>(value?: T, options?: FlipOptions): FlipCase<T> => {
    if (typeof value !== "string" || value.length === 0) {
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

    // For stripEmoji option, completely remove emojis first
    let processedValue = value;

    if (options?.stripEmoji) {
        processedValue = stripEmoji(processedValue) as T;
    }

    // For stripAnsi option, completely remove ANSI codes
    if (options?.stripAnsi) {
        processedValue = stripVTControlCharacters(processedValue) as T;
    }

    // Process the string character by character
    let result = "";
    let index = 0;

    // eslint-disable-next-line no-loops/no-loops
    while (index < processedValue.length) {
        // Handle ANSI sequences if we didn't strip them
        // eslint-disable-next-line security/detect-object-injection
        if (options?.handleAnsi && processedValue[index] === "\u001B") {
            // eslint-disable-next-line security/detect-object-injection
            let ansiSequence = processedValue[index] as string;

            // eslint-disable-next-line no-plusplus
            index++;

            // eslint-disable-next-line no-loops/no-loops,security/detect-object-injection
            while (index < processedValue.length && processedValue[index] !== "m") {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands,security/detect-object-injection
                ansiSequence += processedValue[index];
                // eslint-disable-next-line no-plusplus
                index++;
            }

            if (index < processedValue.length) {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands,security/detect-object-injection
                ansiSequence += processedValue[index];
                result += ansiSequence;
            }

            // eslint-disable-next-line no-plusplus
            index++;

            // eslint-disable-next-line no-continue
            continue;
        }

        // Handle regular characters
        // eslint-disable-next-line security/detect-object-injection
        const char = processedValue[index] as string;
        const lowerChar = options?.locale ? char.toLocaleLowerCase(options.locale) : char.toLowerCase();

        result += char === lowerChar ? (options?.locale ? char.toLocaleUpperCase(options.locale) : char.toUpperCase()) : lowerChar;
        // eslint-disable-next-line no-plusplus
        index++;
    }

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};
