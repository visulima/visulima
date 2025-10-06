import type { Sharp } from "sharp";
import sharp from "sharp";

import type BaseStorage from "../storage/storage";
import type { File, FileQuery, FileReturn } from "../storage/utils/file";
import BaseTransformer from "./base-transformer";
import type { CropOptions, ImageTransformerConfig, ResizeOptions, RotateOptions, TransformationStep, TransformOptions, TransformResult } from "./types";

/**
 * Image transformer that uses storage backends to retrieve and transform images
 *
 * Supports URL-based transformations with query parameters for on-demand image processing.
 * @example
 * ```ts
 * const transformer = new ImageTransformer(storage, {
 *   maxImageSize: 10 * 1024 * 1024, // 10MB
 *   enableCache: true
 * });
 *
 * // Programmatic usage - resize an image
 * const result = await transformer.resize('image-id', {
 *   width: 800,
 *   height: 600,
 *   fit: 'cover'
 * });
 *
 * // URL-based transformations
 * // GET /files/image-id?width=300&height=200&fit=cover&quality=80
 * // GET /files/image-id?width=800&quality=90&lossless=true
 * ```
 *
 * ## Supported Query Parameters
 *
 * - `width`: Width in pixels (Number)
 * - `height`: Height in pixels (Number)
 * - `fit`: Resize fit mode - cover/contain/fill/inside/outside
 * - `position`: Position for cover/contain fits - center/top/right/bottom/left etc.
 * - `quality`: Quality for JPEG/WebP (0-100)
 * - `lossless`: Use lossless compression for WebP (Boolean)
 * - `effort`: CPU effort for AVIF (0-10, higher = slower but better)
 * - `alphaQuality`: Quality of alpha layer for WebP (0-100)
 * - `loop`: GIF animation iterations, 0 for infinite (Number)
 * - `delay`: GIF delay between frames in milliseconds (Number)
 */
class ImageTransformer<TFile extends File = File, TFileReturn extends FileReturn = FileReturn> extends BaseTransformer<
    ImageTransformerConfig,
    TransformResult<TFileReturn>,
    TFile,
    TFileReturn
> {
    public constructor(storage: BaseStorage<TFile, TFileReturn>, config: ImageTransformerConfig = {}) {
        const logger = config.logger || storage.logger;

        const transformerConfig = {
            cacheTtl: 3600, // 1 hour
            enableCache: false,
            maxCacheSize: 100, // Max 100 transformed images in cache
            maxImageSize: 50 * 1024 * 1024, // 50MB
            supportedFormats: ["jpeg", "png", "webp", "avif", "tiff", "gif", "svg"],
            ...config,
        } satisfies ImageTransformerConfig;

        super(storage, transformerConfig, logger);
    }

    /**
     * Resize an image
     */
    public async resize(fileId: string, options: ResizeOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "resize" }]);
    }

    /**
     * Crop an image
     */
    public async crop(fileId: string, options: CropOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "crop" }]);
    }

    /**
     * Rotate an image
     */
    public async rotate(fileId: string, options: RotateOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "rotate" }]);
    }

    /**
     * Convert image format
     */
    public async convertFormat(fileId: string, format: string, options: TransformOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options: { ...options, format: format as any }, type: "format" }]);
    }

    /**
     * Apply a custom transformation pipeline
     */
    public async transform(fileId: string, steps: TransformationStep[]): Promise<TransformResult<TFileReturn>> {
        const fileQuery: FileQuery = { id: fileId };
        const cacheKey = this.generateCacheKey(fileId, steps);

        // Check cache first
        if (this.cache && (this.config as ImageTransformerConfig).enableCache) {
            const cached = this.cache.get(cacheKey);

            if (cached) {
                this.logger?.debug("Returning cached transformed image for %s", fileId);

                return cached;
            }
        }

        // Get original image from storage
        const originalFile = await this.storage.get(fileQuery);

        // Validate image
        await this.validateImage(originalFile);

        // Apply transformations
        const transformedBuffer = await this.applyTransformations(originalFile.content, steps);

        const result = await this.createTransformResult(transformedBuffer, originalFile);

        // Cache the result
        if (this.cache && (this.config as ImageTransformerConfig).enableCache) {
            this.cache.set(cacheKey, result);
        }

        return result;
    }

    /**
     * Clear cache for a specific file
     */
    public override clearCache(fileId?: string): void {
        if (!this.cache) {
            return;
        }

        if (fileId) {
            // Clear all cache entries for this file
            const keysToDelete: string[] = [];

            for (const key of this.cache.keys()) {
                if (key.startsWith(`${fileId}:`)) {
                    keysToDelete.push(key);
                }
            }

            keysToDelete.forEach((key) => this.cache!.delete(key));
        } else {
            // Clear entire cache
            this.cache.clear();
        }
    }

    /**
     * Get cache statistics
     */
    public override getCacheStats(): { maxSize: number; size: number } | undefined {
        if (!this.cache) {
            return undefined;
        }

        return {
            maxSize: this.cache.max,
            size: this.cache.size,
        };
    }

    /**
     * Apply multiple transformations in sequence
     */
    private async applyTransformations(buffer: Buffer, steps: TransformationStep[]): Promise<Buffer> {
        let sharpInstance: Sharp = sharp(buffer);

        for (const step of steps) {
            switch (step.type) {
                case "crop": {
                    sharpInstance = this.applyCrop(sharpInstance, step.options as CropOptions);
                    break;
                }
                case "format":
                case "quality": {
                    sharpInstance = this.applyFormatAndQuality(sharpInstance, step.options);
                    break;
                }
                case "resize": {
                    sharpInstance = this.applyResize(sharpInstance, step.options as ResizeOptions);
                    break;
                }
                case "rotate": {
                    sharpInstance = this.applyRotate(sharpInstance, step.options as RotateOptions);
                    break;
                }
                default: {
                    throw new Error(`Unknown transformation type: ${(step as any).type}`);
                }
            }
        }

        return sharpInstance.toBuffer();
    }

    /**
     * Apply resize transformation
     */
    private applyResize(sharpInstance: Sharp, options: ResizeOptions): Sharp {
        const { background, fit = "cover", height, position, width, withoutEnlargement, withoutReduction, ...formatOptions } = options;

        let resizeOptions: any = {
            background: background || "transparent",
            fit,
            height,
            position,
            width,
            withoutEnlargement,
            withoutReduction,
        };

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            resizeOptions = { ...resizeOptions, ...this.getFormatOptions(formatOptions) };
        }

        return sharpInstance.resize(resizeOptions);
    }

    /**
     * Apply crop transformation
     */
    private applyCrop(sharpInstance: Sharp, options: CropOptions): Sharp {
        const { height, left, top, width, ...formatOptions } = options;

        let cropInstance = sharpInstance.extract({
            height,
            left,
            top,
            width,
        });

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            cropInstance = this.applyFormatAndQuality(cropInstance, formatOptions);
        }

        return cropInstance;
    }

    /**
     * Apply rotate transformation
     */
    private applyRotate(sharpInstance: Sharp, options: RotateOptions): Sharp {
        const { angle, background, ...formatOptions } = options;

        let rotateInstance = sharpInstance.rotate(angle, {
            background: background || "transparent",
        });

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            rotateInstance = this.applyFormatAndQuality(rotateInstance, formatOptions);
        }

        return rotateInstance;
    }

    /**
     * Apply format and quality transformation
     */
    private applyFormatAndQuality(sharpInstance: Sharp, options: TransformOptions): Sharp {
        const formatOptions = this.getFormatOptions(options);

        if (options.format) {
            return sharpInstance.toFormat(options.format, formatOptions);
        }

        // If no format specified but other options exist, apply them to current format
        if (Object.keys(formatOptions).length > 0) {
            return sharpInstance.jpeg(formatOptions).png(formatOptions).webp(formatOptions);
        }

        return sharpInstance;
    }

    /**
     * Get format-specific options
     */
    private getFormatOptions(options: TransformOptions): Record<string, any> {
        const { alphaQuality, compressionLevel, delay, effort, loop, lossless, progressive, quality } = options;
        const formatOptions: Record<string, any> = {};

        if (quality !== undefined) {
            formatOptions.quality = quality;
        }

        if (progressive !== undefined) {
            formatOptions.progressive = progressive;
        }

        if (lossless !== undefined) {
            formatOptions.lossless = lossless;
        }

        if (compressionLevel !== undefined) {
            formatOptions.compressionLevel = compressionLevel;
        }

        if (effort !== undefined) {
            formatOptions.effort = effort;
        }

        if (alphaQuality !== undefined) {
            formatOptions.alphaQuality = alphaQuality;
        }

        if (loop !== undefined) {
            formatOptions.loop = loop;
        }

        if (delay !== undefined) {
            formatOptions.delay = delay;
        }

        return formatOptions;
    }

    /**
     * Validate that the file is a supported image
     */
    private async validateImage(file: TFileReturn): Promise<void> {
        // Check file size
        const fileSize = typeof file.size === "string" ? Number.parseInt(file.size, 10) : file.size;

        if (this.config?.maxImageSize && fileSize > this.config.maxImageSize) {
            throw new Error(`Image size ${fileSize} exceeds maximum allowed size ${this.config.maxImageSize}`);
        }

        // Check if it's an image
        if (!file.contentType?.startsWith("image/")) {
            throw new Error(`File is not an image: ${file.contentType}`);
        }

        // Check format support
        const format = file.contentType.split("/")[1];

        if (this.config?.supportedFormats && format && !this.config.supportedFormats.includes(format)) {
            throw new Error(`Unsupported image format: ${format}`);
        }

        // Additional validation with Sharp
        try {
            const metadata = await sharp(file.content).metadata();

            if (!metadata.width || !metadata.height) {
                throw new Error("Invalid image: missing dimensions");
            }
        } catch (error) {
            throw new Error(`Invalid image file: ${error}`);
        }
    }

    /**
     * Create transformation result
     */
    private async createTransformResult(buffer: Buffer, originalFile: TFileReturn): Promise<TransformResult<TFileReturn>> {
        const metadata = await sharp(buffer).metadata();

        return {
            buffer,
            format: metadata.format || "unknown",
            height: metadata.height || 0,
            originalFile,
            size: buffer.length,
            width: metadata.width || 0,
        };
    }

    /**
     * Generate cache key for transformation
     */
    private generateCacheKey(fileId: string, steps: TransformationStep[]): string {
        const stepsKey = steps.map((step) => `${step.type}:${JSON.stringify(step.options)}`).join("|");

        return `${fileId}:${stepsKey}`;
    }
}

export default ImageTransformer;
