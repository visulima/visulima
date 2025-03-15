import { kebabCase } from "./kebab-case";
import type { CaseOptions, PathCase } from "./types";

// Cache for frequently used path case conversions
const pathCache = new Map<string, string>();

// eslint-disable-next-line no-secrets/no-secrets
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
const pathCase = <T extends string = string>(value?: T, options?: CaseOptions): PathCase<T> =>
    kebabCase(value, { cacheStore: pathCache, ...options, joiner: "/" }) as PathCase<T>;

export default pathCase;
