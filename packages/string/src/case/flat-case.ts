import { kebabCase } from "./kebab-case";
import type { CaseOptions, FlatCase } from "./types";
import LRUCache from "../utils/lru-cache";

const defaultCacheStore = new LRUCache<string, string>(1000);

// eslint-disable-next-line no-secrets/no-secrets
/**
 * Converts a string to flat case (all lowercase, no separators).
 * @example
 * ```typescript
 * flatCase("foo-barBaz") // => "foobarbaz"
 * flatCase("XMLHttpRequest") // => "xmlhttprequest"
 * flatCase("AJAXRequest") // => "ajaxrequest"
 * flatCase("QueryXML123String") // => "queryxml123string"
 * ```
 */
const flatCase = <T extends string = string>(value?: T, options?: CaseOptions): FlatCase<T> =>
    kebabCase(value, { cacheStore: defaultCacheStore, ...options, joiner: "" }) as FlatCase<T>;

export default flatCase;
