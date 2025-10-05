import { LRUCache as Cache } from "lru-cache";
import {
    ALL_FORMATS,
    BufferSource,
    BufferTarget,
    Conversion,
    Input,
    MkvOutputFormat,
    Mp4OutputFormat,
    OggOutputFormat,
    Output,
    WebMOutputFormat,
} from "mediabunny";

import type BaseStorage from "../storage/storage";
import type { FileQuery, FileReturn } from "../storage/utils/file";
import type { Logger } from "../utils/types";
import type {
    VideoCropOptions,
    VideoResizeOptions,
    VideoRotateOptions,
    VideoTransformationStep,
    VideoTransformerConfig,
    VideoTransformOptions,
    VideoTransformResult,
} from "./types";

/**
 * Video transformer that uses storage backends and Mediabunny to retrieve and transform videos
 *
 * Supports video transformations with query parameters for on-demand video processing.
 * @example
 * ```ts
 * const transformer = new VideoTransformer(storage, {
 *   maxVideoSize: 100 * 1024 * 1024, // 100MB
 *   enableCache: true
 * });
 *
 * // Programmatic usage - resize a video
 * const result = await transformer.resize('video-id', {
 *   width: 1920,
 *   height: 1080,
 *   fit: 'contain'
 * });
 *
 * // URL-based transformations
 * // GET /files/video-id?width=1280&height=720&fit=cover&bitrate=2000000
 * // GET /files/video-id?codec=vp9&bitrate=1000000
 * ```
 *
 * ## Supported Query Parameters
 *
 * - `width`: Width in pixels (Number)
 * - `height`: Height in pixels (Number)
 * - `fit`: Resize fit mode - cover/contain/fill/inside/outside
 * - `codec`: Video codec - avc/hevc/vp8/vp9/av1
 * - `bitrate`: Video bitrate in bits per second (Number)
 * - `frameRate`: Frame rate in Hz (Number)
 * - `format`: Output format - mp4/webm/mkv/ogg
 */
class VideoTransformer {
    private readonly cache?: Cache<string, Buffer>;

    private readonly config: Required<VideoTransformerConfig>;

    private readonly logger: Logger;

    public constructor(
        private readonly storage: BaseStorage<any, FileReturn>,
        config: VideoTransformerConfig = {},
    ) {
        this.logger = config.logger || this.storage.logger || console;

        this.config = {
            cacheTtl: 3600, // 1 hour
            defaultBitrate: 2_000_000, // 2 Mbps
            defaultCodec: "avc",
            enableCache: false,
            logger: this.logger,
            maxVideoSize: 500 * 1024 * 1024, // 500MB
            supportedFormats: ["mp4", "webm", "mkv", "avi", "mov", "flv", "wmv"],
            ...config,
        };

        if (this.config.enableCache) {
            this.cache = new Cache({
                max: 50, // Max 50 transformed videos in cache
                ttl: this.config.cacheTtl * 1000, // Convert to milliseconds
            });
        }
    }

    /**
     * Resize a video
     */
    public async resize(fileId: string, options: VideoResizeOptions): Promise<VideoTransformResult> {
        return this.transform(fileId, [{ options, type: "resize" }]);
    }

    /**
     * Crop a video
     */
    public async crop(fileId: string, options: VideoCropOptions): Promise<VideoTransformResult> {
        return this.transform(fileId, [{ options, type: "crop" }]);
    }

    /**
     * Rotate a video
     */
    public async rotate(fileId: string, options: VideoRotateOptions): Promise<VideoTransformResult> {
        return this.transform(fileId, [{ options, type: "rotate" }]);
    }

    /**
     * Convert video format or codec
     */
    public async convertFormat(fileId: string, format: string, options: VideoTransformOptions = {}): Promise<VideoTransformResult> {
        return this.transform(fileId, [{ options: { ...options, format: format as any }, type: "format" }]);
    }

    /**
     * Transcode video to different codec
     */
    public async transcode(
        fileId: string,
        codec: VideoTransformOptions["codec"],
        options: Omit<VideoTransformOptions, "codec"> = {},
    ): Promise<VideoTransformResult> {
        return this.transform(fileId, [{ options: { ...options, codec }, type: "codec" }]);
    }

    /**
     * Apply a custom transformation pipeline
     */
    public async transform(fileId: string, steps: VideoTransformationStep[]): Promise<VideoTransformResult> {
        const fileQuery: FileQuery = { id: fileId };
        const cacheKey = this.generateCacheKey(fileId, steps);

        // Check cache first
        if (this.cache && this.config.enableCache) {
            const cached = this.cache.get(cacheKey);

            if (cached) {
                this.logger?.debug("Returning cached transformed video for %s", fileId);

                return this.createTransformResult(cached, fileQuery);
            }
        }

        // Get original video from storage
        const originalFile = await this.storage.get(fileQuery);

        // Validate video
        await this.validateVideo(originalFile);

        // Apply transformations using Mediabunny
        const transformedBuffer = await this.applyTransformations(originalFile.content, steps);

        // Cache the result
        if (this.cache && this.config.enableCache) {
            this.cache.set(cacheKey, transformedBuffer);
        }

        return this.createTransformResult(transformedBuffer, fileQuery);
    }

    /**
     * Apply multiple transformations in sequence using Mediabunny
     */
    private async applyTransformations(buffer: Buffer, steps: VideoTransformationStep[]): Promise<Buffer> {
        // Create Mediabunny input from buffer
        const input = new Input({
            formats: ALL_FORMATS,
            source: new BufferSource(buffer),
        });

        // Determine output format and create output
        const outputFormat = this.determineOutputFormat(steps);
        const output = new Output({
            format: outputFormat,
            target: new BufferTarget(),
        });

        // Convert transformation steps to Mediabunny video options
        const videoOptions = this.stepsToVideoOptions(steps);

        // Create and execute conversion
        const conversion = await Conversion.init({
            input,
            output,
            video: videoOptions,
        });

        if (!conversion.isValid) {
            const reasons = conversion.discardedTracks.map((track) => track.reason).join(", ");

            throw new Error(`Video transformation failed: ${reasons}`);
        }

        await conversion.execute();

        return Buffer.from(output.target.buffer as ArrayBuffer);
    }

    /**
     * Convert transformation steps to Mediabunny video options
     */
    private stepsToVideoOptions(steps: VideoTransformationStep[]): any {
        const options: any = {};

        for (const step of steps) {
            switch (step.type) {
                case "bitrate": {
                    const bitrateOptions = step.options as VideoTransformOptions;

                    if (bitrateOptions.bitrate) {
                        options.bitrate = bitrateOptions.bitrate;
                    }

                    break;
                }
                case "codec": {
                    const codecOptions = step.options as VideoTransformOptions;

                    if (codecOptions.codec) {
                        options.codec = codecOptions.codec;
                    }

                    if (codecOptions.bitrate) {
                        options.bitrate = codecOptions.bitrate;
                    }

                    break;
                }
                case "crop": {
                    const cropOptions = step.options as VideoCropOptions;

                    options.crop = {
                        height: cropOptions.height,
                        left: cropOptions.left,
                        top: cropOptions.top,
                        width: cropOptions.width,
                    };
                    break;
                }
                case "frameRate": {
                    const frameRateOptions = step.options as VideoTransformOptions;

                    if (frameRateOptions.frameRate) {
                        options.frameRate = frameRateOptions.frameRate;
                    }

                    break;
                }
                case "resize": {
                    const resizeOptions = step.options as VideoResizeOptions;

                    options.width = resizeOptions.width;
                    options.height = resizeOptions.height;
                    options.fit = resizeOptions.fit;

                    if (resizeOptions.position !== undefined) {
                        options.position = resizeOptions.position;
                    }

                    break;
                }
                case "rotate": {
                    const rotateOptions = step.options as VideoRotateOptions;

                    options.rotate = rotateOptions.angle;

                    if (rotateOptions.background) {
                        options.background = rotateOptions.background;
                    }

                    break;
                }
            }
        }

        return options;
    }

    /**
     * Determine output format based on transformation steps
     */
    private determineOutputFormat(steps: VideoTransformationStep[]): any {
        // Check if any step specifies a format
        for (const step of steps) {
            if (step.type === "format" && step.options.format) {
                return this.formatStringToOutputFormat(step.options.format as string);
            }
        }

        // Default to MP4
        return new Mp4OutputFormat();
    }

    /**
     * Convert format string to Mediabunny output format
     */
    private formatStringToOutputFormat(format: string): any {
        switch (format.toLowerCase()) {
            case "mkv": {
                return new MkvOutputFormat();
            }
            case "mp4": {
                return new Mp4OutputFormat();
            }
            case "ogg": {
                return new OggOutputFormat();
            }
            case "webm": {
                return new WebMOutputFormat();
            }
            default: {
                return new Mp4OutputFormat();
            }
        }
    }

    /**
     * Validate that the file is a supported video
     */
    private async validateVideo(file: FileReturn): Promise<void> {
        // Check file size
        const fileSize = typeof file.size === "string" ? Number.parseInt(file.size, 10) : file.size;

        if (fileSize > this.config.maxVideoSize) {
            throw new Error(`Video size ${fileSize} exceeds maximum allowed size ${this.config.maxVideoSize}`);
        }

        // Check if it's a video
        if (!file.contentType?.startsWith("video/")) {
            throw new Error(`File is not a video: ${file.contentType}`);
        }

        // Check format support
        const format = file.contentType.split("/")[1];

        if (format && !this.config.supportedFormats.includes(format)) {
            throw new Error(`Unsupported video format: ${format}`);
        }

        // Additional validation with Mediabunny
        try {
            const input = new Input({
                formats: ALL_FORMATS,
                source: new BufferSource(file.content),
            });

            const primaryTrack = await input.getPrimaryVideoTrack();

            if (!primaryTrack) {
                throw new Error("No video track found");
            }
        } catch (error) {
            throw new Error(`Invalid video file: ${error}`);
        }
    }

    /**
     * Create transformation result
     */
    private async createTransformResult(buffer: Buffer, originalFile: FileQuery): Promise<VideoTransformResult> {
        // For now, return basic metadata. In a real implementation,
        // you might want to parse the transformed video to get accurate metadata
        const input = new Input({
            formats: ALL_FORMATS,
            source: new BufferSource(buffer),
        });

        const videoTrack = await input.getPrimaryVideoTrack();
        const duration = await input.computeDuration();

        return {
            bitrate: this.config.defaultBitrate,
            buffer,
            duration,
            format: "mp4", // Default, would need to detect actual format
            height: videoTrack?.displayHeight || 0,
            originalFile,
            size: buffer.length,
            width: videoTrack?.displayWidth || 0,
        };
    }

    /**
     * Generate cache key for transformation
     */
    private generateCacheKey(fileId: string, steps: VideoTransformationStep[]): string {
        const stepsKey = steps.map((step) => `${step.type}:${JSON.stringify(step.options)}`).join("|");

        return `${fileId}:${stepsKey}`;
    }

    /**
     * Clear cache for a specific file
     */
    public clearCache(fileId?: string): void {
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
    public getCacheStats(): { maxSize: number; size: number } | undefined {
        if (!this.cache) {
            return undefined;
        }

        return {
            maxSize: this.cache.max,
            size: this.cache.size,
        };
    }
}

export default VideoTransformer;
