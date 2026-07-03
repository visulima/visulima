import type { Cache } from "../utils/cache";

/**
 * Base transformer configuration with common properties
 */
export interface BaseTransformerConfig {
    /** Cache instance to use for caching */
    cache?: Cache;
    /** Cache TTL in seconds */
    cacheTtl?: number;
    /** Logger instance */
    logger?: Console;
    /** Maximum number of cached items */
    maxCacheSize?: number;
    /** Supported input formats */
    supportedFormats?: string[] | undefined;
}
