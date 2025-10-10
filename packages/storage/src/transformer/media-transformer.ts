import { createHash } from "node:crypto";

import mime from "mime/lite";

import type BaseStorage from "../storage/storage";
import type { File, FileQuery, FileReturn } from "../storage/utils/file";
import type { Logger } from "../utils/types";
import type BaseTransformer from "./base-transformer";
import type {
    AudioTransformerConfig,
    AudioTransformResult,
    ImageTransformerConfig,
    MediaTransformerConfig,
    MediaTransformQuery,
    MediaTransformResult,
    TransformResult,
    VideoTransformerConfig,
    VideoTransformResult,
} from "./types";
import { isKnownContentType } from "./utils";
import ValidationError from "./validation-error";

/**
 * Unified media transformer that automatically detects media type and routes to appropriate transformer
 *
 * Supports transformations via query parameters for on-demand media processing across all supported formats.
 * @example
 * ```ts
 * const transformer = new MediaTransformer(storage, {
 *   maxImageSize: 10 * 1024 * 1024, // 10MB
 *   maxVideoSize: 100 * 1024 * 1024, // 100MB
 *   maxAudioSize: 50 * 1024 * 1024, // 50MB
 *   enableCache: true, // In-memory caching
 *   saveTransformedFiles: true // Persist transformed files to storage
 * });
 *
 * // Handle transformation via query parameters
 * const result = await transformer.handle('file-id', {
 *   width: 800,
 *   height: 600,
 *   fit: 'cover',
 *   format: 'webp',
 *   quality: 80
 * });
 *
 * // Fetch with URL query string
 * const result = await transformer.fetch('file-id', 'width=1280&height=720&codec=avc&bitrate=2000000');
 *
 * // Clear all cached transformed files
 * transformer.clearSavedTransformedFiles();
 * ```
 *
 * ## Configuration Options
 *
 * - `saveTransformedFiles`: Persist transformed files to storage for reuse (default: false)
 * - `enableCache`: Enable in-memory caching (default: false)
 * - `maxImageSize/maxVideoSize/maxAudioSize`: Size limits for processing
 * - `cacheTtl`: Cache time-to-live in seconds
 *
 * ## Supported Query Parameters
 *
 * ### Common Parameters
 * - `format`: Output format (jpeg/png/webp/avif/mp4/webm/mkv/mp3/wav/ogg/aac/flac)
 * - `quality`: Quality for images (0-100), bitrate for video/audio
 *
 * ### Image Parameters
 * - `width`: Width in pixels
 * - `height`: Height in pixels
 * - `fit`: Resize fit mode - cover/contain/fill/inside/outside
 * - `position`: Position for cover/contain fits
 * - `withoutEnlargement`: Avoid enlarging smaller images (boolean)
 * - `withoutReduction`: Avoid reducing larger images (boolean)
 * - `kernel`: Resize kernel - nearest/cubic/mitchell/lanczos2/lanczos3
 * - `fastShrinkOnLoad`: Fast shrink on load (boolean)
 * - `left/top/cropWidth/cropHeight`: Crop parameters
 * - `angle`: Rotation angle in degrees (any number, but angles other than 90°/180°/270° use interpolation and may affect quality)
 * - `background`: Background color for rotation
 * - `blur`: Apply blur effect (boolean)
 * - `sharpen`: Apply sharpening (boolean)
 * - `median`: Apply median filter with size (number)
 * - `clahe`: Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) (boolean)
 * - `threshold`: Apply thresholding with value (0-255)
 * - `gamma`: Apply gamma correction (boolean)
 * - `negate`: Negate (invert) the image (boolean)
 * - `normalise/normalize`: Normalise the image (boolean)
 * - `flatten`: Flatten alpha channel (boolean)
 * - `unflatten`: Unflatten alpha channel (boolean)
 * - `flip`: Flip image vertically (boolean)
 * - `flop`: Flop image horizontally (boolean)
 * - `greyscale/grayscale`: Convert to greyscale (boolean)
 * - `modulate`: Apply modulation effects (boolean)
 * - `brightness`: Brightness multiplier for modulation (number)
 * - `saturation`: Saturation multiplier for modulation (number)
 * - `hue`: Hue rotation in degrees for modulation (number)
 * - `lightness`: Lightness adjustment for modulation (number)
 * - `tint`: Apply tinting (boolean)
 * - `colourspace`: Convert colourspace - srgb/rgb/cmyk/lab/b-w
 *
 * ### Video Parameters
 * - `width/height/fit`: Same as images
 * - `codec`: Video codec - avc/hevc/vp8/vp9/av1
 * - `bitrate`: Video bitrate in bits per second
 * - `frameRate`: Frame rate in Hz
 * - `keyFrameInterval`: Key frame interval in seconds
 * - `angle`: Rotation angle in degrees (any number, but angles other than 90°/180°/270° use interpolation and may affect quality)
 * - `background`: Background color for rotation
 *
 * ### Audio Parameters
 * - `sampleRate`: Sample rate in Hz
 * - `numberOfChannels`: Number of channels
 * - `codec`: Audio codec - aac/opus/mp3/vorbis/flac
 * - `bitrate`: Audio bitrate in bits per second
 *
 * ## File Persistence
 *
 * When `saveTransformedFiles` is enabled, transformed files are automatically saved to storage
 * with deterministic IDs based on the original file and transformation parameters. Subsequent
 * requests for the same transformation will serve the cached file directly, improving performance
 * and reducing processing costs.
 */
class MediaTransformer<TFile extends File = File, TFileReturn extends FileReturn = FileReturn> {
    private readonly imageTransformer?: BaseTransformer<ImageTransformerConfig, TransformResult<TFileReturn>, TFile, TFileReturn>;

    private readonly videoTransformer?: BaseTransformer<VideoTransformerConfig, VideoTransformResult<TFileReturn>, TFile, TFileReturn>;

    private readonly audioTransformer?: BaseTransformer<AudioTransformerConfig, AudioTransformResult<TFileReturn>, TFile, TFileReturn>;

    private readonly config: Required<
        Omit<MediaTransformerConfig<TFile, TFileReturn>, "logger" | "ImageTransformer" | "VideoTransformer" | "AudioTransformer">
    >;

    private readonly logger: Logger | undefined;

    /**
     * Creates a new MediaTransformer instance
     * @param storage The storage backend for retrieving and storing media files
     * @param config Configuration options for the media transformer including transformer classes and settings
     * @throws Error if no transformer classes are provided in the configuration
     */
    public constructor(
        private readonly storage: BaseStorage<TFile, TFileReturn>,
        config: MediaTransformerConfig<TFile, TFileReturn> = {},
    ) {
        this.logger = config.logger || this.storage.logger;

        this.config = {
            audioBitrate: 128_000, // 128 kbps
            audioCodec: "aac",
            cacheTtl: 3600, // 1 hour
            enableCache: false,
            maxAudioSize: 100 * 1024 * 1024, // 100MB
            maxImageSize: 10 * 1024 * 1024, // 10MB
            maxVideoSize: 500 * 1024 * 1024, // 500MB
            saveTransformedFiles: false, // Save transformed files to storage
            supportedAudioFormats: [],
            supportedImageFormats: [],
            supportedVideoFormats: [],
            videoBitrate: 2_000_000, // 2 Mbps
            videoCodec: "avc",
            ...config,
        };

        if (config.ImageTransformer) {
            if (!Array.isArray(this.config.supportedImageFormats) || this.config.supportedImageFormats.length === 0) {
                this.config.supportedImageFormats = ["jpeg", "png", "webp", "avif", "tiff", "gif", "svg"];
            }

            this.imageTransformer = new config.ImageTransformer(this.storage, {
                cacheTtl: this.config.cacheTtl,
                enableCache: this.config.enableCache,
                logger: this.logger,
                maxImageSize: this.config.maxImageSize,
                supportedFormats: this.config.supportedImageFormats,
            });
        }

        if (config.VideoTransformer) {
            if (!Array.isArray(this.config.supportedVideoFormats) || this.config.supportedVideoFormats.length === 0) {
                this.config.supportedVideoFormats = ["mp4", "webm", "mkv", "avi", "mov", "flv", "wmv"];
            }

            this.videoTransformer = new config.VideoTransformer(this.storage, {
                cacheTtl: this.config.cacheTtl,
                defaultBitrate: this.config.videoBitrate,
                defaultCodec: this.config.videoCodec,
                enableCache: this.config.enableCache,
                logger: this.logger,
                maxVideoSize: this.config.maxVideoSize,
                supportedFormats: this.config.supportedVideoFormats,
            });
        }

        if (config.AudioTransformer) {
            if (!Array.isArray(this.config.supportedAudioFormats) || this.config.supportedAudioFormats.length === 0) {
                this.config.supportedAudioFormats = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "wma", "aiff"];
            }

            this.audioTransformer = new config.AudioTransformer(this.storage, {
                cacheTtl: this.config.cacheTtl,
                defaultBitrate: this.config.audioBitrate,
                defaultCodec: this.config.audioCodec,
                enableCache: this.config.enableCache,
                logger: this.logger,
                maxAudioSize: this.config.maxAudioSize,
                supportedFormats: this.config.supportedAudioFormats,
            });
        }

        // Throw a error if no transfomer is enabled
        if (config.AudioTransformer === undefined && config.ImageTransformer === undefined && config.VideoTransformer === undefined) {
            throw new Error(
                "MediaTransformer initialization failed: No transformers are configured. At least one transformer (AudioTransformer, ImageTransformer, or VideoTransformer) must be provided in the configuration to enable media processing functionality.",
            );
        }
    }

    public supportedFormats(): string[] {
        return [...this.config.supportedAudioFormats, ...this.config.supportedImageFormats, ...this.config.supportedVideoFormats];
    }

    /**
     * Handle media transformation based on query parameters
     * @param fileId File identifier
     * @param query Query parameters for transformation
     * @returns Unified transformation result
     */
    public async handle(fileId: string, query: Record<string, string | undefined> | URLSearchParams | string): Promise<MediaTransformResult> {
        // Parse query parameters
        const parsedQuery = this.parseQuery(query);

        // Get file from storage to determine media type
        const fileQuery: FileQuery = { id: fileId };
        const file = await this.storage.get(fileQuery);

        // Detect media type and validate query parameters
        const mediaType = this.detectMediaType(file.contentType);

        this.validateQueryParameters(parsedQuery, mediaType);

        // Check if we should save/load transformed files from storage
        if (this.config.saveTransformedFiles && this.hasTransformations(parsedQuery)) {
            const transformedFileId = this.generateTransformedFileId(fileId, parsedQuery, mediaType);

            try {
                // Try to get existing transformed file
                const transformedFile = await this.storage.get({ id: transformedFileId });

                this.logger?.debug?.(`Serving cached transformed file: ${transformedFileId}`);

                // Return the cached transformed file
                return this.createMediaTransformResult(transformedFile, mediaType, file);
            } catch {
                // Transformed file doesn't exist, proceed with transformation
                this.logger?.debug?.(`Transformed file not found, processing: ${transformedFileId}`);
            }
        }

        // Perform transformation
        let result: MediaTransformResult;

        switch (mediaType) {
            case "audio": {
                if (!this.audioTransformer) {
                    throw new Error(
                        "Audio transformer not available. Please install audio transformation dependencies or provide an audio transformer instance.",
                    );
                }

                result = await this.handleAudioTransformation(fileId, parsedQuery);
                break;
            }
            case "image": {
                if (!this.imageTransformer) {
                    throw new Error(
                        "Image transformer not available. Please install image transformation dependencies or provide an image transformer instance.",
                    );
                }

                result = await this.handleImageTransformation(fileId, parsedQuery);
                break;
            }
            case "video": {
                if (!this.videoTransformer) {
                    throw new Error(
                        "Video transformer not available. Please install video transformation dependencies or provide a video transformer instance.",
                    );
                }

                result = await this.handleVideoTransformation(fileId, parsedQuery);
                break;
            }
            default: {
                throw new Error(`Unsupported media type: ${file.contentType}`);
            }
        }

        // Save transformed file to storage if enabled and transformations were applied
        if (this.config.saveTransformedFiles && this.hasTransformations(parsedQuery)) {
            await this.saveTransformedFile(result, fileId, parsedQuery, mediaType);
        }

        return result;
    }

    /**
     * Fetch media transformation with URL query string support
     * @param fileId File identifier
     * @param queryString URL query string (e.g., "width=800&amp;height=600&amp;format=webp")
     * @returns Unified transformation result
     */
    public async fetch(fileId: string, queryString: string): Promise<MediaTransformResult> {
        const query = new URLSearchParams(queryString);

        return this.handle(fileId, query);
    }

    /**
     * Clear cache for a specific file across all transformers
     */
    public clearCache(fileId?: string): void {
        this.imageTransformer?.clearCache(fileId);
        this.videoTransformer?.clearCache(fileId);
        this.audioTransformer?.clearCache(fileId);
    }

    /**
     * Clear all saved transformed files from storage
     * Note: This is a maintenance operation and may take time for large numbers of files
     */
    public async clearSavedTransformedFiles(): Promise<void> {
        if (!this.config.saveTransformedFiles) {
            return;
        }

        try {
            // This would need to be implemented based on storage capabilities
            // For now, we'll log that this operation needs custom implementation
            this.logger?.warn?.("clearSavedTransformedFiles requires custom storage implementation to find and delete transformed files");
        } catch (error) {
            this.logger?.error?.(`Failed to clear saved transformed files: ${error}`);
        }
    }

    /**
     * Clear saved transformed files for a specific original file
     */
    public async clearSavedTransformedFilesForFile(originalFileId: string): Promise<void> {
        if (!this.config.saveTransformedFiles) {
            return;
        }

        try {
            // This would need storage-specific implementation to find files by metadata
            // For example, query files where metadata.originalFileId === originalFileId
            this.logger?.warn?.("clearSavedTransformedFilesForFile requires custom storage implementation");
        } catch (error) {
            this.logger?.error?.(`Failed to clear saved transformed files for ${originalFileId}: ${error}`);
        }
    }

    /**
     * Get cache statistics (combined from all transformers)
     */
    public getCacheStats(): {
        audio?: { maxSize: number; size: number };
        image?: { maxSize: number; size: number };
        video?: { maxSize: number; size: number };
    } {
        const stats = {
            audio: this.audioTransformer?.getCacheStats(),
            image: this.imageTransformer?.getCacheStats(),
            video: this.videoTransformer?.getCacheStats(),
        };

        // Remove undefined values to clean up the response
        if (stats.image === undefined)
            delete stats.image;

        if (stats.video === undefined)
            delete stats.video;

        if (stats.audio === undefined)
            delete stats.audio;

        return stats;
    }

    /**
     * Validate query parameters for the given media type
     * @param query The query parameters to validate
     * @param mediaType The media type being validated ('image', 'video', or 'audio')
     * @throws {ValidationError} When invalid parameters are provided
     */
    private validateQueryParameters(query: MediaTransformQuery, mediaType: "image" | "video" | "audio"): void {
        switch (mediaType) {
            case "audio": {
                this.validateAudioQueryParameters(query);
                break;
            }
            case "image": {
                this.validateImageQueryParameters(query);
                break;
            }
            case "video": {
                this.validateVideoQueryParameters(query);
                break;
            }
        }
    }

    /**
     * Validate query parameters for image transformations
     *
     * Checks for:
     * - Invalid video/audio-only parameters
     * - Invalid fit values
     * - Invalid rotation angles
     * - Invalid formats
     * - Incomplete crop parameter sets
     * @param query Query parameters to validate
     * @throws {ValidationError} When validation fails
     */
    private validateImageQueryParameters(query: MediaTransformQuery): void {
        const allowedParameters = new Set([
            "alphaQuality",
            "angle",
            "background",
            "bandbool",
            "blur",
            "boolean",
            "brightness",
            "channel",
            "clahe",
            "colourspace",
            "compressionLevel",
            "convolve",
            "cropHeight",
            "cropWidth",
            "delay",
            "dilate",
            "effort",
            "erode",
            "extractChannel",
            "fastShrinkOnLoad",
            "fit",
            "flatten",
            "flip",
            "flop",
            "format",
            "frameRate",
            "gamma",
            "grayscale",
            "greyscale",
            "height",
            "hue",
            "joinChannel",
            "kernel",
            "left",
            "lightness",
            "linear",
            "loop",
            "maxSlope",
            "median",
            "modulate",
            "negate",
            "normalise",
            "normalize",
            "position",
            "quality",
            "recombine",
            "saturation",
            "sharpen",
            "threshold",
            "tint",
            "top",
            "unflatten",
            "width",
            "withoutEnlargement",
            "withoutReduction",
        ]);

        const videoAudioOnlyParameters = new Set(["bitrate", "codec", "frameRate", "keyFrameInterval", "numberOfChannels", "sampleRate"]);

        const invalidParameters: string[] = [];

        // Check for video/audio-only parameters
        for (const parameter of videoAudioOnlyParameters) {
            if (query[parameter as keyof MediaTransformQuery] !== undefined) {
                invalidParameters.push(parameter);
            }
        }

        if (invalidParameters.length > 0) {
            const sortedInvalidParameters = [...invalidParameters].toSorted();

            throw new ValidationError(
                `Invalid query parameters for image transformation: ${sortedInvalidParameters.join(", ")}. `
                + `Images support: ${[...allowedParameters].toSorted().join(", ")}. `
                + `Video/audio parameters (${sortedInvalidParameters.join(", ")}) are not supported for images.`,
                "INVALID_PARAMS_FOR_IMAGE",
                "image",
                sortedInvalidParameters,
                [...allowedParameters].toSorted(),
            );
        }

        // Validate specific parameter values
        if (query.fit && !["contain", "cover", "fill", "inside", "outside"].includes(query.fit)) {
            throw new ValidationError(
                `Invalid fit value: "${query.fit}". Supported values: "cover", "contain", "fill", "inside", "outside"`,
                "INVALID_FIT_VALUE",
                "image",
                ["fit"],
                ["cover", "contain", "fill", "inside", "outside"],
            );
        }

        if (query.format && !["avif", "gif", "jpeg", "png", "tiff", "webp"].includes(query.format)) {
            throw new ValidationError(
                `Invalid format for image: "${query.format}". Supported formats: jpeg, png, webp, avif, tiff, gif`,
                "INVALID_FORMAT",
                "image",
                ["format"],
                ["jpeg", "png", "webp", "avif", "tiff", "gif"],
            );
        }

        // Validate crop parameters - all must be present if any are provided
        const cropParameters = ["left", "top", "cropWidth", "cropHeight"];
        const providedCropParameters = cropParameters.filter((parameter) => query[parameter as keyof MediaTransformQuery] !== undefined);

        if (providedCropParameters.length > 0 && providedCropParameters.length !== cropParameters.length) {
            throw new ValidationError(
                `Incomplete crop parameters: ${providedCropParameters.join(", ")}. All crop parameters must be provided: left, top, cropWidth, cropHeight`,
                "INCOMPLETE_CROP_PARAMS",
                "image",
                providedCropParameters,
                cropParameters,
            );
        }
    }

    /**
     * Validate query parameters for video transformations
     *
     * Checks for:
     * - Invalid audio-only parameters
     * - Invalid fit values
     * - Invalid rotation angles
     * - Invalid codecs
     * - Invalid formats
     * - Incomplete crop parameter sets
     * - Invalid numeric values (width, height, bitrate, etc.)
     * @param query Query parameters to validate
     * @throws {ValidationError} When validation fails
     */
    private validateVideoQueryParameters(query: MediaTransformQuery): void {
        const allowedParameters = new Set([
            "angle",
            "background",
            "bitrate",
            "codec",
            "cropHeight",
            "cropWidth",
            "fit",
            "format",
            "frameRate",
            "height",
            "keyFrameInterval",
            "left",
            "position",
            "quality",
            "top",
            "width",
            "withoutEnlargement",
            "withoutReduction",
        ]);

        const audioOnlyParameters = new Set(["numberOfChannels", "sampleRate"]);

        const invalidParameters: string[] = [];

        // Check for audio-only parameters
        for (const parameter of audioOnlyParameters) {
            if (query[parameter as keyof MediaTransformQuery] !== undefined) {
                invalidParameters.push(parameter);
            }
        }

        if (invalidParameters.length > 0) {
            const sortedInvalidParameters = [...invalidParameters].toSorted();

            throw new ValidationError(
                `Invalid query parameters for video transformation: ${sortedInvalidParameters.join(", ")}. `
                + `Videos support: ${[...allowedParameters].toSorted().join(", ")}. `
                + `Audio-only parameters (${sortedInvalidParameters.join(", ")}) are not supported for videos.`,
                "INVALID_PARAMS_FOR_VIDEO",
                "video",
                sortedInvalidParameters,
                [...allowedParameters].toSorted(),
            );
        }

        // Validate specific parameter values
        if (query.fit && !["contain", "cover", "fill", "inside", "outside"].includes(query.fit)) {
            throw new ValidationError(
                `Invalid fit value: "${query.fit}". Supported values: "cover", "contain", "fill", "inside", "outside"`,
                "INVALID_FIT_VALUE",
                "video",
                ["fit"],
                ["cover", "contain", "fill", "inside", "outside"],
            );
        }

        if (query.codec && !["av1", "avc", "hevc", "vp8", "vp9"].includes(query.codec)) {
            throw new ValidationError(
                `Invalid codec for video: "${query.codec}". Supported codecs: avc, hevc, vp8, vp9, av1`,
                "INVALID_VIDEO_CODEC",
                "video",
                ["codec"],
                ["avc", "hevc", "vp8", "vp9", "av1"],
            );
        }

        if (query.format && !["mkv", "mp4", "ogg", "webm"].includes(query.format)) {
            throw new ValidationError(
                `Invalid format for video: "${query.format}". Supported formats: mp4, webm, mkv, ogg`,
                "INVALID_VIDEO_FORMAT",
                "video",
                ["format"],
                ["mp4", "webm", "mkv", "ogg"],
            );
        }

        // Validate crop parameters - all must be present if any are provided
        const cropParameters = ["left", "top", "cropWidth", "cropHeight"];
        const providedCropParameters = cropParameters.filter((parameter) => query[parameter as keyof MediaTransformQuery] !== undefined);

        if (providedCropParameters.length > 0 && providedCropParameters.length !== cropParameters.length) {
            throw new ValidationError(
                `Incomplete crop parameters: ${providedCropParameters.join(", ")}. All crop parameters must be provided: left, top, cropWidth, cropHeight`,
                "INCOMPLETE_CROP_PARAMS",
                "video",
                providedCropParameters,
                cropParameters,
            );
        }

        // Validate numeric parameters
        if (query.width !== undefined && (typeof query.width !== "number" || query.width <= 0)) {
            throw new ValidationError(`Invalid width: ${query.width}. Must be a positive number.`, "INVALID_WIDTH", "video", ["width"], []);
        }

        if (query.height !== undefined && (typeof query.height !== "number" || query.height <= 0)) {
            throw new ValidationError(`Invalid height: ${query.height}. Must be a positive number.`, "INVALID_HEIGHT", "video", ["height"], []);
        }

        if (query.bitrate !== undefined && (typeof query.bitrate !== "number" || query.bitrate <= 0)) {
            throw new ValidationError(`Invalid bitrate: ${query.bitrate}. Must be a positive number.`, "INVALID_BITRATE", "video", ["bitrate"], []);
        }

        if (query.frameRate !== undefined && (typeof query.frameRate !== "number" || query.frameRate <= 0)) {
            throw new ValidationError(`Invalid frameRate: ${query.frameRate}. Must be a positive number.`, "INVALID_FRAME_RATE", "video", ["frameRate"], []);
        }

        if (query.keyFrameInterval !== undefined && (typeof query.keyFrameInterval !== "number" || query.keyFrameInterval <= 0)) {
            throw new ValidationError(
                `Invalid keyFrameInterval: ${query.keyFrameInterval}. Must be a positive number.`,
                "INVALID_KEY_FRAME_INTERVAL",
                "video",
                ["keyFrameInterval"],
                [],
            );
        }
    }

    /**
     * Generate a unique ID for transformed files based on original file and transformations
     * @param originalFileId The original file identifier
     * @param query The transformation query parameters
     * @param mediaType The media type (image, video, audio)
     * @returns Unique deterministic identifier for the transformed file
     * @private
     */
    private generateTransformedFileId(originalFileId: string, query: MediaTransformQuery, mediaType: string): string {
        // Create a deterministic hash of the transformation parameters
        const transformParameters = Object.keys(query)
            .filter((key) => query[key as keyof MediaTransformQuery] !== undefined)
            .toSorted()
            .map((key) => `${key}:${query[key as keyof MediaTransformQuery]}`)
            .join("|");

        const hashInput = `${originalFileId}|${mediaType}|${transformParameters}`;
        const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

        return `${originalFileId}_transformed_${hash}`;
    }

    /**
     * Check if the query contains any transformations
     * @param query The transformation query parameters
     * @returns True if any transformations are requested
     * @private
     */
    private hasTransformations(query: MediaTransformQuery): boolean {
        return this.hasImageTransformations(query) || this.hasVideoTransformations(query) || this.hasAudioTransformations(query);
    }

    /**
     * Create a MediaTransformResult from a stored transformed file
     * @param storedFile The stored transformed file
     * @param mediaType The media type (image, video, audio)
     * @param originalFile The original file information
     * @returns Media transformation result with metadata
     * @private
     */
    private createMediaTransformResult(storedFile: TFileReturn, mediaType: string, originalFile: TFileReturn): MediaTransformResult {
        const baseResult = {
            buffer: storedFile.content,
            format: this.getFormatFromContentType(storedFile.contentType || ""),
            mediaType: mediaType as "image" | "video" | "audio",
            originalFile,
            size: storedFile.content.length,
        };

        // Add media-specific properties based on type
        switch (mediaType) {
            case "audio": {
                return {
                    ...baseResult,
                    bitrate: (storedFile as any).bitrate,
                    duration: (storedFile as any).duration,
                    mediaType: "audio",
                    numberOfChannels: (storedFile as any).numberOfChannels,
                    sampleRate: (storedFile as any).sampleRate,
                };
            }
            case "image": {
                return {
                    ...baseResult,
                    height: (storedFile as any).height,
                    mediaType: "image",
                    width: (storedFile as any).width,
                };
            }
            case "video": {
                return {
                    ...baseResult,
                    bitrate: (storedFile as any).bitrate,
                    duration: (storedFile as any).duration,
                    height: (storedFile as any).height,
                    mediaType: "video",
                    width: (storedFile as any).width,
                };
            }
            default: {
                return baseResult;
            }
        }
    }

    /**
     * Extract format from content type
     * @param contentType MIME content type string
     * @returns Format string extracted from content type
     * @private
     */
    // eslint-disable-next-line class-methods-use-this
    private getFormatFromContentType(contentType: string): string {
        if (!contentType) {
            return "";
        }

        // Use mime package to get extension from content type
        const extension = mime.getExtension(contentType);

        return extension || "application/octet-stream";
    }

    /**
     * Save transformed file to storage
     * @param result The transformation result to save
     * @param originalFileId The original file identifier
     * @param query The transformation query parameters
     * @param mediaType The media type (image, video, audio)
     * @returns Promise that resolves when file is saved
     * @private
     */
    private async saveTransformedFile(result: MediaTransformResult, originalFileId: string, query: MediaTransformQuery, mediaType: string): Promise<void> {
        try {
            const transformedFileId = this.generateTransformedFileId(originalFileId, query, mediaType);

            // Create metadata for the transformed file
            const metadata: Record<string, any> = {
                format: result.format,
                mediaType,
                originalFileId,
                size: result.size,
                transformation: query,
                transformedAt: new Date().toISOString(),
            };

            // Add media-specific metadata
            if (mediaType === "image" && result.width && result.height) {
                metadata.width = result.width;
                metadata.height = result.height;
            } else if (mediaType === "video" && result.width && result.height) {
                metadata.width = result.width;
                metadata.height = result.height;
                metadata.duration = result.duration;
                metadata.bitrate = result.bitrate;
            } else if (mediaType === "audio") {
                metadata.duration = result.duration;
                metadata.numberOfChannels = result.numberOfChannels;
                metadata.sampleRate = result.sampleRate;
                metadata.bitrate = result.bitrate;
            }

            // Create a mock request object for storage.create
            const mockRequest = {
                body: result.buffer,
                headers: {
                    "content-type": mime.getType(result.format),
                },
            } as any;

            // Save to storage
            await this.storage.create(mockRequest, {
                contentType: mime.getType(result.format) ?? undefined,
                metadata,
                originalName: `${transformedFileId}.${result.format}`,
                size: result.size,
            });

            this.logger?.debug?.(`Saved transformed file: ${transformedFileId}`);
        } catch (error) {
            // Log error but don't fail the transformation
            this.logger?.error?.(`Failed to save transformed file: ${error}`);
        }
    }

    /**
     * Validate query parameters for audio transformations
     *
     * Checks for:
     * - Invalid video-only parameters
     * - Invalid codecs
     * - Invalid formats
     * - Invalid numeric values (bitrate, channels, sample rate)
     * @param query Query parameters to validate
     * @throws {ValidationError} When validation fails
     */
    private validateAudioQueryParameters(query: MediaTransformQuery): void {
        const allowedParameters = new Set(["bitrate", "codec", "format", "numberOfChannels", "quality", "sampleRate"]);

        const videoOnlyParameters = new Set([
            "angle",
            "background",
            "cropHeight",
            "cropWidth",
            "fit",
            "frameRate",
            "height",
            "keyFrameInterval",
            "left",
            "position",
            "top",
            "width",
            "withoutEnlargement",
            "withoutReduction",
        ]);

        const invalidParameters: string[] = [];

        // Check for video-only parameters
        for (const parameter of videoOnlyParameters) {
            if (query[parameter as keyof MediaTransformQuery] !== undefined) {
                invalidParameters.push(parameter);
            }
        }

        if (invalidParameters.length > 0) {
            const sortedInvalidParameters = [...invalidParameters].toSorted();

            throw new ValidationError(
                `Invalid query parameters for audio transformation: ${sortedInvalidParameters.join(", ")}. `
                + `Audio supports: ${[...allowedParameters].toSorted().join(", ")}. `
                + `Video-only parameters (${sortedInvalidParameters.join(", ")}) are not supported for audio.`,
                "INVALID_PARAMS_FOR_AUDIO",
                "audio",
                sortedInvalidParameters,
                [...allowedParameters].toSorted(),
            );
        }

        // Validate specific parameter values
        if (query.codec && !["aac", "flac", "mp3", "opus", "vorbis"].includes(query.codec)) {
            throw new ValidationError(
                `Invalid codec for audio: "${query.codec}". Supported codecs: aac, opus, mp3, vorbis, flac`,
                "INVALID_AUDIO_CODEC",
                "audio",
                ["codec"],
                ["aac", "opus", "mp3", "vorbis", "flac"],
            );
        }

        if (query.format && !["aac", "flac", "mp3", "ogg", "wav"].includes(query.format)) {
            throw new ValidationError(
                `Invalid format for audio: "${query.format}". Supported formats: mp3, wav, ogg, aac, flac`,
                "INVALID_AUDIO_FORMAT",
                "audio",
                ["format"],
                ["mp3", "wav", "ogg", "aac", "flac"],
            );
        }

        // Validate numeric parameters
        if (query.bitrate !== undefined && (typeof query.bitrate !== "number" || query.bitrate <= 0)) {
            throw new ValidationError(`Invalid bitrate: ${query.bitrate}. Must be a positive number.`, "INVALID_BITRATE", "audio", ["bitrate"], []);
        }

        if (query.numberOfChannels !== undefined && (typeof query.numberOfChannels !== "number" || query.numberOfChannels <= 0 || query.numberOfChannels > 8)) {
            throw new ValidationError(
                `Invalid numberOfChannels: ${query.numberOfChannels}. Must be a number between 1 and 8.`,
                "INVALID_CHANNEL_COUNT",
                "audio",
                ["numberOfChannels"],
                ["1", "2", "3", "4", "5", "6", "7", "8"],
            );
        }

        if (query.sampleRate !== undefined) {
            const validSampleRates = [8000, 11_025, 16_000, 22_050, 32_000, 44_100, 48_000, 88_200, 96_000, 192_000];

            if (typeof query.sampleRate !== "number" || !validSampleRates.includes(query.sampleRate)) {
                throw new ValidationError(
                    `Invalid sampleRate: ${query.sampleRate}. Supported sample rates: ${validSampleRates.join(", ")}`,
                    "INVALID_SAMPLE_RATE",
                    "audio",
                    ["sampleRate"],
                    validSampleRates.map(String),
                );
            }
        }
    }

    /**
     * Handle image transformation
     * @param fileId The file identifier
     * @param query The transformation query parameters
     * @returns Promise resolving to media transformation result
     * @private
     */
    private async handleImageTransformation(fileId: string, query: MediaTransformQuery): Promise<MediaTransformResult> {
        const steps: any[] = [];

        // Check if any transformations are requested
        if (this.hasImageTransformations(query)) {
            // Build transformation steps based on query parameters
            if (query.width || query.height || query.fit) {
                steps.push({
                    options: {
                        fit: query.fit,
                        height: query.height,
                        position: query.position,
                        width: query.width,
                        withoutEnlargement: query.withoutEnlargement,
                        withoutReduction: query.withoutReduction,
                    },
                    type: "resize",
                });
            }

            if (query.left !== undefined && query.top !== undefined && query.cropWidth && query.cropHeight) {
                steps.push({
                    options: {
                        height: query.cropHeight,
                        left: query.left,
                        top: query.top,
                        width: query.cropWidth,
                    },
                    type: "crop",
                });
            }

            if (query.angle) {
                steps.push({
                    options: {
                        angle: query.angle,
                        background: query.background,
                    },
                    type: "rotate",
                });
            }

            if (query.format) {
                steps.push({
                    options: {
                        format: query.format,
                        quality: query.quality,
                    },
                    type: "format",
                });
            } else if (query.quality) {
                steps.push({
                    options: {
                        quality: query.quality,
                    },
                    type: "quality",
                });
            }
        }

        // Apply transformations
        const result = steps.length > 0 ? await this.imageTransformer!.transform(fileId, steps) : await this.imageTransformer!.transform(fileId, []); // No transformations

        // Convert to unified result format
        return this.convertImageResult(result);
    }

    /**
     * Handle video transformation
     * @param fileId The file identifier
     * @param query The transformation query parameters
     * @returns Promise resolving to media transformation result
     * @private
     */
    private async handleVideoTransformation(fileId: string, query: MediaTransformQuery): Promise<MediaTransformResult> {
        const steps: any[] = [];

        // Check if any transformations are requested
        if (this.hasVideoTransformations(query)) {
            // Build transformation steps based on query parameters
            if (query.width || query.height || query.fit) {
                steps.push({
                    options: {
                        fit: query.fit,
                        height: query.height,
                        position: query.position,
                        width: query.width,
                        withoutEnlargement: query.withoutEnlargement,
                        withoutReduction: query.withoutReduction,
                    },
                    type: "resize",
                });
            }

            if (query.left !== undefined && query.top !== undefined && query.cropWidth && query.cropHeight) {
                steps.push({
                    options: {
                        height: Number(query.cropHeight),
                        left: query.left,
                        top: query.top,
                        width: query.cropWidth,
                    },
                    type: "crop",
                });
            }

            if (query.angle) {
                steps.push({
                    options: {
                        angle: query.angle,
                        background: query.background,
                    },
                    type: "rotate",
                });
            }

            if (query.codec || query.bitrate) {
                steps.push({
                    options: {
                        bitrate: query.bitrate || query.quality,
                        codec: query.codec,
                        frameRate: query.frameRate,
                        keyFrameInterval: query.keyFrameInterval,
                    },
                    type: "codec",
                });
            }

            if (query.format) {
                steps.push({
                    options: {
                        format: query.format,
                    },
                    type: "format",
                });
            }
        }

        // Apply transformations
        const result = steps.length > 0 ? await this.videoTransformer!.transform(fileId, steps) : await this.videoTransformer!.transform(fileId, []); // No transformations

        // Convert to unified result format
        return this.convertVideoResult(result);
    }

    /**
     * Handle audio transformation
     * @param fileId The file identifier
     * @param query The transformation query parameters
     * @returns Promise resolving to media transformation result
     * @private
     */
    private async handleAudioTransformation(fileId: string, query: MediaTransformQuery): Promise<MediaTransformResult> {
        const steps: any[] = [];

        // Check if any transformations are requested
        if (this.hasAudioTransformations(query)) {
            // Build transformation steps based on query parameters
            if (query.sampleRate) {
                steps.push({
                    options: {
                        sampleRate: query.sampleRate,
                    },
                    type: "resample",
                });
            }

            if (query.numberOfChannels) {
                steps.push({
                    options: {
                        numberOfChannels: query.numberOfChannels,
                    },
                    type: "channels",
                });
            }

            if (query.codec || query.bitrate) {
                steps.push({
                    options: {
                        bitrate: query.bitrate || query.quality,
                        codec: query.codec,
                    },
                    type: "codec",
                });
            }

            if (query.format) {
                steps.push({
                    options: {
                        format: query.format,
                    },
                    type: "format",
                });
            }
        }

        // Apply transformations
        const result = steps.length > 0 ? await this.audioTransformer!.transform(fileId, steps) : await this.audioTransformer!.transform(fileId, []); // No transformations

        // Convert to unified result format
        return this.convertAudioResult(result);
    }

    /**
     * Parse query parameters from various input formats
     * @param query Query parameters in various formats
     * @returns Normalized MediaTransformQuery object
     * @private
     */
    private parseQuery(query: Record<string, string | undefined> | URLSearchParams | string): MediaTransformQuery {
        if (typeof query === "string") {
            return this.parseURLSearchParams(new URLSearchParams(query));
        }

        if (query instanceof URLSearchParams) {
            return this.parseURLSearchParams(query);
        }

        const transformQuery: MediaTransformQuery = query;

        if (query.left) {
            transformQuery.left = Number.parseInt(query.left, 10);
        }

        if (query.top) {
            transformQuery.top = Number.parseInt(query.top, 10);
        }

        if (query.cropWidth) {
            transformQuery.cropWidth = Number.parseInt(query.cropWidth, 10);
        }

        if (query.cropHeight) {
            transformQuery.cropHeight = Number.parseInt(query.cropHeight, 10);
        }

        if (query.angle) {
            transformQuery.angle = Number.parseInt(query.angle, 10);
        }

        if (query.quality) {
            transformQuery.quality = Number.parseInt(query.quality, 10);
        }

        // Parse image/video parameters
        if (query.width) {
            transformQuery.width = Number.parseInt(query.width, 10);
        }

        if (query.height) {
            transformQuery.height = Number.parseInt(query.height, 10);
        }

        if (query.bitrate) {
            transformQuery.bitrate = Number.parseInt(query.bitrate, 10);
        }

        if (query.frameRate) {
            transformQuery.frameRate = Number.parseInt(query.frameRate, 10);
        }

        if (query.keyFrameInterval) {
            transformQuery.keyFrameInterval = Number.parseInt(query.keyFrameInterval, 10);
        }

        // Parse audio parameters
        if (query.numberOfChannels) {
            transformQuery.numberOfChannels = Number.parseInt(query.numberOfChannels, 10);
        }

        if (query.sampleRate) {
            transformQuery.sampleRate = Number.parseInt(query.sampleRate, 10);
        }

        return transformQuery;
    }

    /**
     * Parse boolean parameter from string
     * @param value String value to parse
     * @returns Boolean value or undefined
     * @private
     */
    private parseBooleanParameter(value: string | null): boolean | undefined {
        if (value === null)
            return undefined;

        return value === "true" || value === "1";
    }

    /**
     * Parse URLSearchParams into MediaTransformQuery
     * @param parameters URL search parameters object
     * @returns MediaTransformQuery object with parsed parameters
     * @private
     */
    private parseURLSearchParams(parameters: URLSearchParams): MediaTransformQuery {
        const query: MediaTransformQuery = {};

        // Parse common parameters
        if (parameters.has("format")) {
            query.format = parameters.get("format") ?? undefined;
        }

        if (parameters.has("quality")) {
            query.quality = parameters.get("quality") ? Number.parseInt(parameters.get("quality") as string, 10) : undefined;
        }

        // Parse image/video parameters
        if (parameters.has("width")) {
            query.width = parameters.get("width") ? Number.parseInt(parameters.get("width") as string, 10) : undefined;
        }

        if (parameters.has("height")) {
            query.height = parameters.get("height") ? Number.parseInt(parameters.get("height") as string, 10) : undefined;
        }

        if (parameters.has("fit")) {
            const fitValue = parameters.get("fit");

            if (fitValue && ["contain", "cover", "fill", "inside", "outside"].includes(fitValue)) {
                query.fit = fitValue as "cover" | "contain" | "fill" | "inside" | "outside";
            }
        }

        if (parameters.has("position")) {
            query.position = parameters.get("position") ?? undefined;
        }

        if (parameters.has("withoutEnlargement")) {
            const value = parameters.get("withoutEnlargement");

            query.withoutEnlargement = value === "true" ? true : undefined;
        }

        if (parameters.has("withoutReduction")) {
            const value = parameters.get("withoutReduction");

            query.withoutReduction = value === "true" ? true : undefined;
        }

        // Parse crop parameters
        if (parameters.has("left")) {
            query.left = parameters.get("left") ? Number.parseInt(parameters.get("left") as string, 10) : undefined;
        }

        if (parameters.has("top")) {
            query.top = parameters.get("top") ? Number.parseInt(parameters.get("top") as string, 10) : undefined;
        }

        if (parameters.has("cropWidth")) {
            query.cropWidth = parameters.get("cropWidth") ? Number.parseInt(parameters.get("cropWidth") as string, 10) : undefined;
        }

        if (parameters.has("cropHeight")) {
            query.cropHeight = parameters.get("cropHeight") ? Number.parseInt(parameters.get("cropHeight") as string, 10) : undefined;
        }

        // Parse transformation parameters
        if (parameters.has("angle")) {
            const angleValue = parameters.get("angle") ? Number.parseInt(parameters.get("angle") as string, 10) : undefined;

            if (angleValue !== undefined) {
                query.angle = angleValue;
            }
        }

        if (parameters.has("background")) {
            query.background = parameters.get("background") ?? undefined;
        }

        // Parse image operation parameters
        if (parameters.has("blur")) {
            query.blur = this.parseBooleanParameter(parameters.get("blur"));
        }

        if (parameters.has("sharpen")) {
            query.sharpen = this.parseBooleanParameter(parameters.get("sharpen"));
        }

        if (parameters.has("median")) {
            query.median = parameters.get("median") ? Number.parseInt(parameters.get("median") as string, 10) : undefined;
        }

        if (parameters.has("clahe")) {
            query.clahe = this.parseBooleanParameter(parameters.get("clahe"));
        }

        if (parameters.has("threshold")) {
            query.threshold = parameters.get("threshold") ? Number.parseInt(parameters.get("threshold") as string, 10) : undefined;
        }

        if (parameters.has("gamma")) {
            query.gamma = this.parseBooleanParameter(parameters.get("gamma"));
        }

        if (parameters.has("negate")) {
            query.negate = this.parseBooleanParameter(parameters.get("negate"));
        }

        if (parameters.has("normalise") || parameters.has("normalize")) {
            query.normalise = this.parseBooleanParameter(parameters.get("normalise")) || this.parseBooleanParameter(parameters.get("normalize"));
        }

        if (parameters.has("flatten")) {
            query.flatten = this.parseBooleanParameter(parameters.get("flatten"));
        }

        if (parameters.has("unflatten")) {
            query.unflatten = this.parseBooleanParameter(parameters.get("unflatten"));
        }

        if (parameters.has("flip")) {
            query.flip = this.parseBooleanParameter(parameters.get("flip"));
        }

        if (parameters.has("flop")) {
            query.flop = this.parseBooleanParameter(parameters.get("flop"));
        }

        if (parameters.has("affine")) {
            query.affine = this.parseBooleanParameter(parameters.get("affine"));
        }

        if (parameters.has("dilate")) {
            query.dilate = this.parseBooleanParameter(parameters.get("dilate"));
        }

        if (parameters.has("erode")) {
            query.erode = this.parseBooleanParameter(parameters.get("erode"));
        }

        if (parameters.has("pipelineColourspace")) {
            query.pipelineColourspace = this.parseBooleanParameter(parameters.get("pipelineColourspace"));
        }

        if (parameters.has("toColourspace")) {
            query.toColourspace = this.parseBooleanParameter(parameters.get("toColourspace"));
        }

        if (parameters.has("removeAlpha")) {
            query.removeAlpha = this.parseBooleanParameter(parameters.get("removeAlpha"));
        }

        if (parameters.has("ensureAlpha")) {
            query.ensureAlpha = this.parseBooleanParameter(parameters.get("ensureAlpha"));
        }

        if (parameters.has("greyscale") || parameters.has("grayscale")) {
            query.greyscale = this.parseBooleanParameter(parameters.get("greyscale")) || this.parseBooleanParameter(parameters.get("grayscale"));
        }

        if (parameters.has("modulate")) {
            query.modulate = this.parseBooleanParameter(parameters.get("modulate"));
        }

        if (parameters.has("tint")) {
            query.tint = this.parseBooleanParameter(parameters.get("tint"));
        }

        // Parse advanced parameters
        if (parameters.has("brightness")) {
            query.brightness = parameters.get("brightness") ? Number.parseFloat(parameters.get("brightness") as string) : undefined;
        }

        if (parameters.has("saturation")) {
            query.saturation = parameters.get("saturation") ? Number.parseFloat(parameters.get("saturation") as string) : undefined;
        }

        if (parameters.has("hue")) {
            query.hue = parameters.get("hue") ? Number.parseInt(parameters.get("hue") as string, 10) : undefined;
        }

        if (parameters.has("lightness")) {
            query.lightness = parameters.get("lightness") ? Number.parseInt(parameters.get("lightness") as string, 10) : undefined;
        }

        if (parameters.has("kernel")) {
            query.kernel = parameters.get("kernel") ?? undefined;
        }

        if (parameters.has("fastShrinkOnLoad")) {
            query.fastShrinkOnLoad = parameters.get("fastShrinkOnLoad") === "true";
        }

        // Parse video parameters
        if (parameters.has("codec")) {
            const codecValue = parameters.get("codec");
            const validCodecs = ["avc", "hevc", "vp8", "vp9", "av1", "aac", "opus", "mp3", "vorbis", "flac"];

            if (codecValue && validCodecs.includes(codecValue)) {
                query.codec = codecValue as "avc" | "hevc" | "vp8" | "vp9" | "av1" | "aac" | "opus" | "mp3" | "vorbis" | "flac";
            }
        }

        if (parameters.has("bitrate")) {
            query.bitrate = parameters.get("bitrate") ? Number.parseInt(parameters.get("bitrate") as string, 10) : undefined;
        }

        if (parameters.has("frameRate")) {
            query.frameRate = parameters.get("frameRate") ? Number.parseInt(parameters.get("frameRate") as string, 10) : undefined;
        }

        if (parameters.has("keyFrameInterval")) {
            query.keyFrameInterval = parameters.get("keyFrameInterval") ? Number.parseInt(parameters.get("keyFrameInterval") as string, 10) : undefined;
        }

        // Parse audio parameters
        if (parameters.has("numberOfChannels")) {
            query.numberOfChannels = parameters.get("numberOfChannels") ? Number.parseInt(parameters.get("numberOfChannels") as string, 10) : undefined;
        }

        if (parameters.has("sampleRate")) {
            query.sampleRate = parameters.get("sampleRate") ? Number.parseInt(parameters.get("sampleRate") as string, 10) : undefined;
        }

        return query;
    }

    /**
     * Detect media type from MIME type
     * @param contentType MIME content type string
     * @returns Detected media type
     * @throws Error if content type is missing or unsupported
     * @private
     */
    private detectMediaType(contentType: string | undefined): "image" | "video" | "audio" {
        if (!contentType) {
            throw new Error("Cannot detect media type: no content type provided");
        }

        // First check with mime package to validate the content type is known
        if (!isKnownContentType(contentType)) {
            throw new Error(`Unknown or invalid content type: ${contentType}`);
        }

        // Then determine media type from content type prefix
        if (contentType.startsWith("image/")) {
            return "image";
        }

        if (contentType.startsWith("video/")) {
            return "video";
        }

        if (contentType.startsWith("audio/")) {
            return "audio";
        }

        throw new Error(`Unsupported media type for content type: ${contentType}`);
    }

    /**
     * Check if query has image transformations
     * @param query The transformation query parameters
     * @returns True if image transformations are requested
     * @private
     */
    // eslint-disable-next-line class-methods-use-this
    private hasImageTransformations(query: MediaTransformQuery): boolean {
        return !!(
            query.width
            || query.height
            || query.fit
            || query.position
            || query.withoutEnlargement
            || query.withoutReduction
            || query.left !== undefined
            || query.top !== undefined
            || query.cropWidth
            || query.cropHeight
            || query.angle !== undefined
            || query.background
            || query.blur
            || query.sharpen
            || query.median
            || query.clahe
            || query.threshold !== undefined
            || query.gamma
            || query.negate
            || query.normalise
            || query.flatten
            || query.unflatten
            || query.flip
            || query.flop
            || query.greyscale
            || query.modulate
            || query.tint
            || query.brightness !== undefined
            || query.saturation !== undefined
            || query.hue !== undefined
            || query.lightness !== undefined
            || query.kernel
            || query.fastShrinkOnLoad
            || query.affine
            || query.dilate
            || query.erode
            || query.pipelineColourspace
            || query.toColourspace
            || query.removeAlpha
            || query.ensureAlpha
            || query.format
            || query.quality
        );
    }

    /**
     * Check if query has video transformations
     * @param query The transformation query parameters
     * @returns True if video transformations are requested
     * @private
     */
    private hasVideoTransformations(query: MediaTransformQuery): boolean {
        return !!(
            query.width
            || query.height
            || query.fit
            || query.position
            || query.withoutEnlargement
            || query.withoutReduction
            || query.left !== undefined
            || query.top !== undefined
            || query.cropWidth
            || query.cropHeight
            || query.angle
            || query.background
            || query.codec
            || query.bitrate
            || query.frameRate
            || query.keyFrameInterval
            || query.format
            || query.quality
        );
    }

    /**
     * Check if query has audio transformations
     * @param query The transformation query parameters
     * @returns True if audio transformations are requested
     * @private
     */
    private hasAudioTransformations(query: MediaTransformQuery): boolean {
        return !!(query.sampleRate || query.numberOfChannels || query.codec || query.bitrate || query.format || query.quality);
    }

    /**
     * Convert ImageTransformer result to unified format
     * @param result The image transformation result
     * @returns Unified media transformation result
     * @private
     */
    private convertImageResult(result: TransformResult): MediaTransformResult {
        return {
            buffer: result.buffer,
            format: result.format,
            height: result.height,
            mediaType: "image",
            originalFile: result.originalFile,
            size: result.size,
            width: result.width,
        };
    }

    /**
     * Convert VideoTransformer result to unified format
     * @param result The video transformation result
     * @returns Unified media transformation result
     * @private
     */
    private convertVideoResult(result: VideoTransformResult): MediaTransformResult {
        return {
            bitrate: result.bitrate,
            buffer: result.buffer,
            duration: result.duration,
            format: result.format,
            height: result.height,
            mediaType: "video",
            originalFile: result.originalFile,
            size: result.size,
            width: result.width,
        };
    }

    /**
     * Convert AudioTransformer result to unified format
     * @param result The audio transformation result
     * @returns Unified media transformation result
     * @private
     */
    private convertAudioResult(result: AudioTransformResult): MediaTransformResult {
        return {
            bitrate: result.bitrate,
            buffer: result.buffer,
            duration: result.duration,
            format: result.format,
            mediaType: "audio",
            numberOfChannels: result.numberOfChannels,
            originalFile: result.originalFile,
            sampleRate: result.sampleRate,
            size: result.size,
        };
    }
}

export default MediaTransformer;
