import type { ConstantCase, LocaleOptions } from "../types";
import { snakeCase } from "./snake-case";

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
export const constantCase = <T extends string = string>(value: T, options: LocaleOptions = {}): ConstantCase<T> => {
    const { locale } = options;
    const result = snakeCase(value, options);
    
    return (locale ? result.toLocaleUpperCase(locale) : result.toUpperCase()) as ConstantCase<T>;
};
