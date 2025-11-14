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
import type { File, FileQuery, FileReturn } from "../storage/utils/file";
import BaseTransformer from "./base-transformer";
import type {
    VideoCropOptions,
    VideoResizeOptions,
    VideoRotateOptions,
    VideoTransformationStep,
    VideoTransformerConfig,
    VideoTransformOptions,
    VideoTransformResult,
} from "./types";
import { getFormatFromContentType, isValidMediaType } from "./utils";

/**
 * Video transformer that uses storage backends and Mediabunny to retrieve and transform videos
 *
 * Supports video transformations with query parameters for on-demand video processing.
 * @example
 * ```ts
 * const transformer = new VideoTransformer(storage, {
 *   maxVideoSize: 100 * 1024 * 1024, // 100MB
 *   cache: new Map()
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
class VideoTransformer<TFile extends File = File, TFileReturn extends FileReturn = FileReturn> extends BaseTransformer<
    VideoTransformerConfig,
    VideoTransformResult<TFileReturn>,
    TFile,
    TFileReturn
> {
    /**
     * Creates a new VideoTransformer instance.
     * @param storage The storage backend for retrieving and storing video files
     * @param config Configuration options for video transformation including cache settings, codec defaults, and size limits
     */
    public constructor(storage: BaseStorage<TFile, TFileReturn>, config: VideoTransformerConfig = {}) {
        const logger = config.logger || storage.logger;

        const transformerConfig = {
            cacheTtl: 3600, // 1 hour
            defaultBitrate: 2_000_000, // 2 Mbps
            defaultCodec: "avc" as const,
            // No cache provided - no caching
            maxCacheSize: 50, // Max 50 transformed videos in cache
            maxVideoSize: 500 * 1024 * 1024, // 500MB
            supportedFormats: ["mp4", "webm", "mkv", "avi", "mov", "flv", "wmv"],
            ...config,
        } satisfies VideoTransformerConfig;

        super(storage, transformerConfig, logger);
    }

    /**
     * Resize a video to specified dimensions with optional fit mode.
     * @param fileId Unique identifier of the video file to resize
     * @param options Resize options including width, height, and fit mode
     * @returns Promise resolving to transformed video result
     */
    public async resize(fileId: string, options: VideoResizeOptions): Promise<VideoTransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "resize" }]);
    }

    /**
     * Crop a video
     */
    public async crop(fileId: string, options: VideoCropOptions): Promise<VideoTransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "crop" }]);
    }

    /**
     * Rotate a video
     */
    public async rotate(fileId: string, options: VideoRotateOptions): Promise<VideoTransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "rotate" }]);
    }

    /**
     * Convert video format or codec
     */
    public async convertFormat(fileId: string, format: string, options: VideoTransformOptions = {}): Promise<VideoTransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options: { ...options, format: format as any }, type: "format" }]);
    }

    /**
     * Transcode video to different codec
     */
    public async transcode(
        fileId: string,
        codec: VideoTransformOptions["codec"],
        options: Omit<VideoTransformOptions, "codec"> = {},
    ): Promise<VideoTransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options: { ...options, codec }, type: "codec" }]);
    }

    /**
     * Apply a custom transformation pipeline
     */
    public async transform(fileId: string, steps: VideoTransformationStep[]): Promise<VideoTransformResult<TFileReturn>> {
        const fileQuery: FileQuery = { id: fileId };
        const cacheKey = this.generateCacheKey(fileId, steps);

        // Check cache first
        if (this.cache) {
            const cached = this.cache.get(cacheKey);

            if (cached) {
                this.logger?.debug("Returning cached transformed video for %s", fileId);

                return cached;
            }
        }

        // Get original video from storage
        const originalFile = await this.storage.get(fileQuery);

        // Validate video
        await this.validateVideo(originalFile);

        // Apply transformations using Mediabunny
        const transformedBuffer = await this.applyTransformations(originalFile.content, steps);

        const result = await this.createTransformResult(transformedBuffer, originalFile);

        // Cache the result
        if (this.cache) {
            this.cache.set(cacheKey, result);
        }

        return result;
    }

    /**
     * Apply multiple transformations in sequence using Mediabunny
     * @param buffer The original video buffer
     * @param steps Array of video transformation steps to apply
     * @returns Promise resolving to transformed video buffer
     * @private
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
     * @param steps Array of video transformation steps to convert
     * @returns Mediabunny video options object for conversion
     * @private
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
     * @param steps Array of video transformation steps
     * @returns Mediabunny output format instance (defaults to MP4)
     * @private
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
     * @param format Video format string (mp4, webm, mkv, ogg)
     * @returns Mediabunny output format instance
     * @private
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
     * @param file The file to validate
     * @returns Promise that resolves if validation passes
     * @throws Error if file size exceeds limits, wrong content type, unsupported format, or invalid video
     * @private
     */
    private async validateVideo(file: TFileReturn): Promise<void> {
        // Check file size
        const fileSize = typeof file.size === "string" ? Number.parseInt(file.size, 10) : file.size;

        if (this.config?.maxVideoSize && fileSize > this.config.maxVideoSize) {
            throw new Error(`Video size ${fileSize} exceeds maximum allowed size ${this.config.maxVideoSize}`);
        }

        // Check if it's a video
        if (!isValidMediaType(file.contentType, "video")) {
            throw new Error(`File is not a video: ${file.contentType}`);
        }

        // Check format support
        const format = getFormatFromContentType(file.contentType);

        if (this.config?.supportedFormats && format && !this.config.supportedFormats.includes(format)) {
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
     * Create transformation result with metadata
     * @param buffer The transformed video buffer
     * @param originalFile The original file information
     * @returns Video transformation result with metadata
     * @private
     */
    private async createTransformResult(buffer: Buffer, originalFile: TFileReturn): Promise<VideoTransformResult<TFileReturn>> {
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
     * @param fileId The file identifier
     * @param steps Array of transformation steps
     * @returns Unique cache key string
     * @private
     */
    private generateCacheKey(fileId: string, steps: VideoTransformationStep[]): string {
        const stepsKey = steps.map((step) => `${step.type}:${JSON.stringify(step.options)}`).join("|");

        return `${fileId}:${stepsKey}`;
    }
}

export default VideoTransformer;
