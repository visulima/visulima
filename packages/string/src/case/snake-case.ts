import type { CaseOptions, SnakeCase } from "./types";
import { kebabCase } from "./kebab-case";

/**
 * Converts a string to snake_case.
 * @example
 * ```typescript
 * snakeCase("fooBar") // => "foo_bar"
 * snakeCase("foo bar") // => "foo_bar"
 * snakeCase("foo-bar") // => "foo_bar"
 * snakeCase("XMLHttpRequest") // => "xml_http_request"
 * snakeCase("AJAXRequest") // => "ajax_request"
 * snakeCase("QueryXML123String") // => "query_xml_123_string"
 * ```
 */
export const snakeCase = <T extends string = string>(value: T, options: CaseOptions = {}): SnakeCase<T> => {
    return kebabCase(value, { ...options, joiner: "_" }) as SnakeCase<T>;
};
