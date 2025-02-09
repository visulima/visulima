import { splitByCase } from "./split-by-case";
import type { CaseOptions, KebabCase } from "./types";
import { normalizeGermanEszett } from "./utils/normalize-german-eszett";
import { fastJoin, fastLowerCase } from "./utils/string-ops";

export interface KebabCaseOptions extends CaseOptions {
    /**
     * The string to use as a joiner between words.
     * @default "-"
     */
    joiner?: string;
}

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
// Cache for frequently used kebab case conversions
const kebabCache = new Map<string, string>();
const CACHE_MAX_SIZE = 1000;

export const kebabCase = <T extends string = string>(value?: T, options?: KebabCaseOptions): KebabCase<T> => {
    if (typeof value !== "string") {
        return "" as KebabCase<T>;
    }

    // For simple cases without options, use cache
    if (!options) {
        const cached = kebabCache.get(value);
        if (cached) {
            return cached as KebabCase<T>;
        }
    }

    const words = splitByCase(value, options);
    const processed = words.map((p) => {
        const split = normalizeGermanEszett(p, options?.locale);
        return fastLowerCase(split, options?.locale);
    });

    const result = fastJoin(processed, options?.joiner ?? "-") as KebabCase<T>;

    // Cache the result for simple cases
    if (!options && kebabCache.size < CACHE_MAX_SIZE) {
        kebabCache.set(value, result);
    }

    return result;
};
