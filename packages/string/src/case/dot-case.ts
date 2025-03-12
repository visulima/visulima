import { kebabCase } from "./kebab-case";
import type { CaseOptions, DotCase } from "./types";

// Cache for frequently used dot case conversions
const dotCache = new Map<string, string>();

// eslint-disable-next-line no-secrets/no-secrets
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
const dotCase = <T extends string = string>(value?: T, options?: CaseOptions): DotCase<T> =>
    kebabCase(value, { cacheStore: dotCache, ...options, joiner: "." }) as DotCase<T>;

export default dotCase;
