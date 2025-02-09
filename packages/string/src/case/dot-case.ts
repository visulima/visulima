import type { DotCase, CaseOptions } from "./types";
import { kebabCase } from "./kebab-case";

/**
 * Converts a string to dot.case.
 * @example
 * ```typescript
 * dotCase("foo bar") // => "foo.bar"
 * dotCase("foo-bar") // => "foo.bar"
 * dotCase("foo_bar") // => "foo.bar"
 * dotCase("XMLHttpRequest") // => "xml.http.request"
 * dotCase("AJAXRequest") // => "ajax.request"
 * dotCase("QueryXML123String") // => "query.xml.123.string"
 * ```
 */
export const dotCase = <T extends string = string>(value: T, options: CaseOptions = {}): DotCase<T> =>
    kebabCase(value, { ...options, joiner: "." }) as DotCase<T>;
