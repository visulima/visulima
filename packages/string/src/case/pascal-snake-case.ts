import { noCase } from "./no-case";
import type { CaseOptions, PascalSnakeCase } from "./types";
import { upperFirst } from "./upper-first";
import { generateCacheKey } from "./utils/generate-cache-key";
import { manageCache } from "./utils/manage-cache";

// Cache for frequently used pascal snake case conversions
const pascalSnakeCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Converts a string to Pascal_Snake_Case.
 * @example
 * ```typescript
 * pascalSnakeCase("foo bar") // => "Foo_Bar"
 * pascalSnakeCase("foo-bar") // => "Foo_Bar"
 * pascalSnakeCase("foo_bar") // => "Foo_Bar"
 * pascalSnakeCase("XMLHttpRequest") // => "Xml_Http_Request"
 * pascalSnakeCase("AJAXRequest") // => "Ajax_Request"
 * pascalSnakeCase("QueryXML123String") // => "Query_Xml_123_String"
 * ```
 */
export const pascalSnakeCase = <T extends string = string>(value?: T, options?: CaseOptions): PascalSnakeCase<T> => {
    if (typeof value !== "string") {
        return "" as PascalSnakeCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? pascalSnakeCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached as PascalSnakeCase<T>;
        }
    }

    const words = noCase(value, { ...options, cache: false }).split(" ");
    const result = words.map((word) => upperFirst(word, { locale: options?.locale })).join("_") as PascalSnakeCase<T>;

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
};
