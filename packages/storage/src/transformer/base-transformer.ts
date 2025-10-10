import { Readable } from "node:stream";

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

    /**
     * Creates a new BaseTransformer instance with common functionality
     * @param storage The storage backend for retrieving and storing files
     * @param config Configuration options for the transformer
     * @param logger Optional logger instance for logging operations
     * @protected
     */
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

    /**
     * Stream transform a file with the given steps (for large files)
     */
    public async transformStream?(fileId: string, steps: any[]): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        // Default implementation falls back to regular transform
        const result = await this.transform(fileId, steps);

        // If result has a buffer, create a stream from it
        if (result && "buffer" in result) {
            const { buffer } = result;

            return {
                headers: {
                    "Content-Length": buffer.length.toString(),
                    "Content-Type": this.getContentTypeFromResult(result),
                },
                size: buffer.length,
                stream: Readable.from(buffer),
            };
        }

        throw new Error("Streaming transformation not supported for this transformer");
    }

    /**
     * Get content type from transformation result
     */
    protected getContentTypeFromResult(_result: any): string {
        // Default implementation - should be overridden by subclasses
        return "application/octet-stream";
    }
}

export default BaseTransformer;
