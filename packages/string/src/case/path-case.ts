import { kebabCase } from "./kebab-case";
import type { CaseOptions, PathCase } from "./types";

/**
 * Converts a string to path/case.
 * @example
 * ```typescript
 * pathCase("foo bar") // => "foo/bar"
 * pathCase("foo-bar") // => "foo/bar"
 * pathCase("foo_bar") // => "foo/bar"
 * pathCase("XMLHttpRequest") // => "xml/http/request"
 * pathCase("AJAXRequest") // => "ajax/request"
 * pathCase("QueryXML123String") // => "query/xml/123/string"
 * ```
 */
export const pathCase = <T extends string = string>(value?: T, options?: CaseOptions): PathCase<T> =>
    kebabCase(value, { ...options, joiner: "/" }) as PathCase<T>;
