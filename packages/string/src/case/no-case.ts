import { kebabCase } from "./kebab-case";
import type { CaseOptions, NoCase } from "./types";
import LRUCache from "../utils/lru-cache";

const defaultCacheStore = new LRUCache<string, string>(1000);

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
    kebabCase(value, { cacheStore: defaultCacheStore, ...options, joiner: " " }) as NoCase<T>;

export default noCase;
