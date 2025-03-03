import { kebabCase } from "./kebab-case";
import type { CaseOptions, FlatCase } from "./types";

// Cache for frequently used flat case conversions
const flatCache = new Map<string, string>();

/**
 * Converts a string to flatcase (all lowercase, no separators).
 * @example
 * ```typescript
 * flatCase("foo-barBaz") // => "foobarbaz"
 * flatCase("XMLHttpRequest") // => "xmlhttprequest"
 * flatCase("AJAXRequest") // => "ajaxrequest"
 * flatCase("QueryXML123String") // => "queryxml123string"
 * ```
 */
const flatCase = <T extends string = string>(value?: T, options?: CaseOptions): FlatCase<T> =>
    kebabCase(value, { cacheStore: flatCache, ...options, joiner: "" }) as FlatCase<T>;

export default flatCase;
