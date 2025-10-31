import { Readable } from "node:stream";

import mime from "mime";

import type BaseStorage from "../storage/storage";
import type { File, FileReturn } from "../storage/utils/file";
import type { Cache } from "../utils/cache";
import { NoOpCache } from "../utils/cache";
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

        this.cache = config.cache ?? new NoOpCache();
    }

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
    // eslint-disable-next-line class-methods-use-this
    protected getContentTypeFromResult(result: any): string {
        // If result has a format, try to get content type from mime
        if (result?.format) {
            const contentType = mime.getType(result.format);

            if (contentType) {
                return contentType;
            }
        }

        return "application/octet-stream";
    }
}

export default BaseTransformer;
