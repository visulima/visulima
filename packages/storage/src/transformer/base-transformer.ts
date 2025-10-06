import { LRUCache as Cache } from "lru-cache";

import type BaseStorage from "../storage/storage";
import type { File, FileReturn } from "../storage/utils/file";
import type { Logger } from "../utils/types";
import type { BaseTransformerConfig } from "./types";

/**
 * Abstract base class for all media transformers
 *
 * Provides a common interface and shared functionality for image, video, and audio transformers.
 * All transformers must implement the abstract methods defined here.
 */
abstract class BaseTransformer<
    Config extends BaseTransformerConfig,
    CacheValue extends object,
    TFile extends File = File,
    TFileReturn extends FileReturn = FileReturn,
> {
    protected config: Config;

    protected logger?: Logger;

    protected cache?: Cache<string, CacheValue>;

    protected constructor(
        protected readonly storage: BaseStorage<TFile, TFileReturn>,
        config: Config,
        logger?: Logger,
    ) {
        this.config = config;
        this.logger = logger;

        if (config.enableCache) {
            this.cache = new Cache({
                max: config.maxCacheSize || 100, // Default cache size
                ttl: (config.cacheTtl || 3600) * 1000, // Convert to milliseconds, default 1 hour
            });
        }
    }

    /**
     * Clear cache for a specific file or all files
     */
    public abstract clearCache(fileId?: string): void;

    /**
     * Get cache statistics
     */
    public abstract getCacheStats(): { maxSize: number; size: number } | undefined;

    /**
     * Transform a file with the given steps
     */
    public abstract transform(fileId: string, steps: any[]): Promise<any>;
}

export default BaseTransformer;
