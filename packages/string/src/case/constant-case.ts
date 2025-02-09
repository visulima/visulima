import { snakeCase } from "./snake-case";
import type { CaseOptions, ConstantCase } from "./types";

/**
 * Converts a string to CONSTANT_CASE.
 * @example
 * ```typescript
 * constantCase("foo bar") // => "FOO_BAR"
 * constantCase("foo-bar") // => "FOO_BAR"
 * constantCase("foo_bar") // => "FOO_BAR"
 * constantCase("XMLHttpRequest") // => "XML_HTTP_REQUEST"
 * constantCase("AJAXRequest") // => "AJAX_REQUEST"
 * constantCase("QueryXML123String") // => "QUERY_XML_123_STRING"
 * ```
 */
export const constantCase = <T extends string = string>(value?: T, options?: CaseOptions): ConstantCase<T> => {
    const result = snakeCase(value, options);

    return (options?.locale ? result.toLocaleUpperCase(options.locale) : result.toUpperCase()) as ConstantCase<T>;
};
