import { Readable } from "node:stream";

import type { BaseStorage } from "../storage/storage";
import type { File, FileReturn } from "../storage/utils/file";
import type { Cache } from "../utils/cache";
import { NoOpCache } from "../utils/cache";
import type { BaseTransformerConfig } from "./transformer-config";
import { getContentTypeFromFormat, sourceVersion } from "./utils";

/**
 * Abstract base class for all media transformers.
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

    protected logger?: Console;

    protected cache?: Cache<string, CacheValue>;

    /** Kind of media this transformer produces; decides e.g. `video/ogg` over `audio/ogg`. */
    protected readonly mediaType?: "image" | "video" | "audio";

    /**
     * Expiry time of every entry this instance cached, oldest first. Enforces `cacheTtl` even on
     * caches that ignore the `ttl` option (a plain `Map`) and evicts the oldest entries past
     * `maxCacheSize`.
     */
    private readonly cacheExpiry = new Map<string, number>();

    /**
     * Creates a new BaseTransformer instance with common functionality.
     * @param storage The storage backend for retrieving and storing files.
     * @param config Configuration options for the transformer.
     * @param logger Optional logger instance for logging operations.
     * @protected
     */
    protected constructor(
        protected readonly storage: BaseStorage<TFile, TFileReturn>,
        config: Config,
        logger?: Console,
    ) {
        this.config = config;
        this.logger = logger;

        this.cache = (config.cache ?? new NoOpCache()) as Cache<string, CacheValue>;
    }

    /**
     * Transforms a file with the given steps.
     * @param fileId Unique identifier of the file to transform.
     * @param steps Array of transformation steps to apply.
     * @returns Promise resolving to transformation result.
     */
    public abstract transform(fileId: string, steps: any[]): Promise<any>;

    /**
     * Streams transform of a file with the given steps (for large files).
     * @param fileId Unique identifier of the file to transform.
     * @param steps Array of transformation steps to apply.
     * @returns Promise resolving to streaming result with headers, size, and stream.
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
     * Clears cache for a specific file or all files.
     *
     * Cache keys are `${fileId}:${stepsHash}@${version}` (see `generateCacheKey` in subclasses),
     * so per-file invalidation must iterate keys to find every transform of `fileId`.
     * Falls back to a full `clear()` when the underlying cache doesn't expose `keys()`.
     * @param fileId Optional file identifier to clear cache for specific file.
     */
    public clearCache(fileId?: string): void {
        if (!fileId) {
            this.cacheExpiry.clear();
            this.cache?.clear?.();

            return;
        }

        for (const key of this.cacheExpiry.keys()) {
            if (key.startsWith(`${fileId}:`)) {
                this.cacheExpiry.delete(key);
            }
        }

        if (!this.cache) {
            return;
        }

        if (typeof this.cache.keys !== "function") {
            this.logger?.warn?.("clearCache(fileId) cannot scope its invalidation because the cache does not implement keys(); falling back to full clear()");
            this.cache.clear?.();

            return;
        }

        const prefix = `${fileId}:`;

        for (const key of this.cache.keys()) {
            if (typeof key === "string" && (key === fileId || key.startsWith(prefix))) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Gets cache statistics.
     * @returns Cache statistics including max size and current size.
     */
    public getCacheStats(): { maxSize: number; size: number } {
        // Default implementation - subclasses can override for more specific stats
        // Cache interface doesn't have a size property, so we return 0 as default
        return {
            maxSize: this.config.maxCacheSize ?? -1, // -1 indicates unlimited or unknown max size
            size: (this.cache as any)?.size ?? 0,
        };
    }

    /**
     * Turn a `${fileId}:${steps}` key into the key actually used in the cache by appending the
     * original's version (ETag, modification time, size), so replacing the original misses the
     * cache instead of serving a stale transform. Returns `undefined` — skip caching — when caching
     * is disabled or the original's metadata can't be read.
     */
    protected async versionedCacheKey(fileId: string, cacheKey: string): Promise<string | undefined> {
        if (!this.cache || this.cache instanceof NoOpCache) {
            return undefined;
        }

        let meta: TFile;

        try {
            meta = await this.storage.getMeta(fileId);
        } catch {
            return undefined;
        }

        return `${cacheKey}@${sourceVersion(meta)}`;
    }

    /** Read a cached transform, treating entries older than `cacheTtl` as misses. */
    protected async getCached(key: string | undefined): Promise<CacheValue | undefined> {
        if (key === undefined || !this.cache) {
            return undefined;
        }

        const expiresAt = this.cacheExpiry.get(key);

        if (expiresAt !== undefined && expiresAt <= Date.now()) {
            this.cacheExpiry.delete(key);
            await this.cache.delete(key);

            return undefined;
        }

        return this.cache.get(key);
    }

    /** Cache a transform with `cacheTtl`, evicting this instance's oldest entries past `maxCacheSize`. */
    protected async setCached(key: string | undefined, value: CacheValue): Promise<void> {
        if (key === undefined || !this.cache) {
            return;
        }

        const ttlMs = this.config.cacheTtl ? this.config.cacheTtl * 1000 : undefined;

        await this.cache.set(key, value, ttlMs ? { ttl: ttlMs } : undefined);

        // Re-insert so the Map's insertion order stays oldest-first.
        this.cacheExpiry.delete(key);
        this.cacheExpiry.set(key, ttlMs ? Date.now() + ttlMs : Number.POSITIVE_INFINITY);

        const max = this.config.maxCacheSize;

        if (!max || max <= 0) {
            return;
        }

        for (const oldest of this.cacheExpiry.keys()) {
            if (this.cacheExpiry.size <= max) {
                break;
            }

            this.cacheExpiry.delete(oldest);
            await this.cache.delete(oldest);
        }
    }

    /**
     * Gets content type from transformation result based on format.
     * @param result Transformation result object containing format information.
     * @returns Content type string (MIME type).
     */
    protected getContentTypeFromResult(result: any): string {
        return getContentTypeFromFormat(result?.format, this.mediaType) ?? "application/octet-stream";
    }
}

export default BaseTransformer;
