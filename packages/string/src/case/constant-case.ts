import { kebabCase } from "./kebab-case";
import type { CaseOptions, ConstantCase } from "./types";

// Cache for frequently used constant case conversions
const constantCache = new Map<string, string>();

// eslint-disable-next-line no-secrets/no-secrets
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
const constantCase = <T extends string = string>(value?: T, options?: CaseOptions): ConstantCase<T> =>
    kebabCase(value, { cacheStore: constantCache, ...options, joiner: "_", toUpperCase: true }) as ConstantCase<T>;

export default constantCase;
