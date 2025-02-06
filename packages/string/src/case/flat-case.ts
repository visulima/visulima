import type { FlatCase, LocaleOptions } from "../types";
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
export const flatCase = <T extends string = string>(value: T, options: LocaleOptions = {}): FlatCase<T> => {
    if (typeof value !== "string") {
        return "" as FlatCase<T>;
    }

    return kebabCase(value, { ...options, joiner: "" }) as FlatCase<T>;
};
