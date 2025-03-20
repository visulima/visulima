import { kebabCase } from "./kebab-case";
import type { CaseOptions, DotCase } from "./types";
import LRUCache from "../utils/lru-cache";

const defaultCacheStore = new LRUCache<string, string>(1000);

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
    kebabCase(value, { cacheStore: defaultCacheStore, ...options, joiner: "." }) as DotCase<T>;

export default dotCase;
