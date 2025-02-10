import { lowerFirst } from "./lower-first";
import { pascalCase } from "./pascal-case";
import type { CamelCase, CaseOptions } from "./types";
import { generateCacheKey } from "./utils/generate-cache-key";
import { manageCache } from "./utils/manage-cache";

// Cache for frequently used camel case conversions
const camelCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

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
export const camelCase = <T extends string = string>(value?: T, options?: CaseOptions): CamelCase<T> => {
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

    const result = lowerFirst(pascalCase(value, { ...options, cache: false }), { locale: options?.locale }) as CamelCase<T>;

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};
