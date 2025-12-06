import { stripVTControlCharacters } from "node:util";

import { stripEmoji } from "../constants";
import LRUCache from "../utils/lru-cache";
import type { CaseOptions, FlipCase } from "./types";
import generateCacheKey from "./utils/generate-cache-key";

const defaultCacheStore = new LRUCache<string, string>(1000);

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
    const cacheStore = options?.cacheStore ?? defaultCacheStore;
    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey && cacheStore.has(cacheKey)) {
        return cacheStore.get(cacheKey) as FlipCase<T>;
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

    while (index < processedValue.length) {
        // Handle ANSI sequences if we didn't strip them

        if (options?.handleAnsi && processedValue[index] === "\u001B") {
            let ansiSequence = processedValue[index] as string;

            index += 1;

            while (index < processedValue.length && processedValue[index] !== "m") {
                ansiSequence += processedValue[index];

                index += 1;
            }

            if (index < processedValue.length) {
                ansiSequence += processedValue[index];
                result += ansiSequence;
            }

            index += 1;

            continue;
        }

        // Handle regular characters

        const char = processedValue[index] as string;
        const lowerChar = options?.locale ? char.toLocaleLowerCase(options.locale) : char.toLowerCase();

        result += char === lowerChar ? options?.locale ? char.toLocaleUpperCase(options.locale) : char.toUpperCase() : lowerChar;

        index += 1;
    }

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        cacheStore.set(cacheKey, result);
    }

    return result;
};
