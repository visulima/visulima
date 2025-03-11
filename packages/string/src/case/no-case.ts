import { kebabCase } from "./kebab-case";
import type { CaseOptions, NoCase } from "./types";

// Cache for frequently used no case conversions
const noCache = new Map<string, string>();

// eslint-disable-next-line no-secrets/no-secrets
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
const noCase = <T extends string = string>(value?: T, options?: CaseOptions): NoCase<T> =>
    kebabCase(value, { cacheStore: noCache, ...options, joiner: " " }) as NoCase<T>;

export default noCase;
