import type { FlatCase, CaseOptions } from "./types";
import { kebabCase } from "./kebab-case";

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
export const flatCase = <T extends string = string>(value: T, options: CaseOptions = {}): FlatCase<T> => {
    return kebabCase(value, { ...options, joiner: "" }) as FlatCase<T>;
};
