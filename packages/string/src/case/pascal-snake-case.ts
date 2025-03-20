import noCase from "./no-case";
import type { CaseOptions, PascalSnakeCase } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import LRUCache from "../utils/lru-cache";

const defaultCacheStore = new LRUCache<string, string>(1000);

// eslint-disable-next-line no-secrets/no-secrets
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
const pascalSnakeCase = <T extends string = string>(value?: T, options?: CaseOptions): PascalSnakeCase<T> => {
    if (typeof value !== "string") {
        return "" as PascalSnakeCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheStore = options?.cacheStore ?? defaultCacheStore;
    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey && cacheStore.has(cacheKey)) {
        return cacheStore.get(cacheKey) as PascalSnakeCase<T>;
    }

    const words = noCase(value, { ...options, cache: false }).split(" ");
    const result = words.map((word: string) => upperFirst(word, { locale: options?.locale })).join("_") as PascalSnakeCase<T>;

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        cacheStore.set(cacheKey, result);
    }

    return result;
};

export default pascalSnakeCase;
