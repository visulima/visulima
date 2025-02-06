import type { LocaleOptions, NoCase } from "../types";
import { kebabCase } from "./kebab-case";

/**
 * Converts a string to no case (space separated words).
 * @example
 * ```typescript
 * noCase("foo bar") // => "foo bar"
 * noCase("foo-bar") // => "foo bar"
 * noCase("foo_bar") // => "foo bar"
 * noCase("XMLHttpRequest") // => "xml http request"
 * noCase("AJAXRequest") // => "ajax request"
 * noCase("QueryXML123String") // => "query xml 123 string"
 * ```
 */
export const noCase = <T extends string = string>(value: T, options: LocaleOptions = {}): NoCase<T> =>
    kebabCase(value, { ...options, joiner: " " }) as NoCase<T>;
