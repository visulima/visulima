import LRUCache from "../utils/lru-cache";
import { kebabCase } from "./kebab-case";
import type { CaseOptions, SnakeCase } from "./types";

const defaultCacheStore = new LRUCache<string, string>(1000);

/**
 * Converts a string to snake_case.
 * @example
 * ```typescript
 * snakeCase("fooBar") // => "foo_bar"
 * snakeCase("foo bar") // => "foo_bar"
 * snakeCase("foo-bar") // => "foo_bar"
 * snakeCase("XMLHttpRequest") // => "xml_http_request"
 * snakeCase("AJAXRequest") // => "ajax_request"
 * snakeCase("QueryXML123String") // => "query_xml_123_string"
 * ```
 */
const snakeCase = <T extends string = string>(value?: T, options?: CaseOptions): SnakeCase<T> =>
    kebabCase(value, { cacheStore: defaultCacheStore, ...options, joiner: "_" }) as SnakeCase<T>;

export default snakeCase;
