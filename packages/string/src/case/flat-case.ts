import { kebabCase } from "./kebab-case";
import type { CaseOptions, FlatCase } from "./types";

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
export const flatCase = <T extends string = string>(value?: T, options?: CaseOptions): FlatCase<T> =>
    kebabCase(value, { ...options, joiner: "" }) as FlatCase<T>;
