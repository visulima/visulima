import { createHash } from "node:crypto";

import type BaseStorage from "../storage/storage";
import type { FileQuery, FileReturn } from "../storage/utils/file";
import type { Logger } from "../utils/types";
import AudioTransformer from "./audio-transformer";
import ImageTransformer from "./image-transformer";
import type { AudioTransformResult, MediaTransformerConfig, MediaTransformQuery, MediaTransformResult, TransformResult, VideoTransformResult } from "./types";
import VideoTransformer from "./video-transformer";

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
    public readonly code: string;

    public readonly details: {
        invalidParams: string[];
        mediaType: string;
        suggestions?: string[];
        validParams: string[];
    };

    constructor(message: string, code: string, mediaType: string, invalidParameters: string[], validParameters: string[], suggestions?: string[]) {
        super(message);
        this.name = "ValidationError";
        this.code = code;
        this.details = {
            invalidParams: invalidParameters,
            mediaType,
            suggestions,
            validParams: validParameters,
        };
    }
}

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
 * - `left/top/cropWidth/cropHeight`: Crop parameters
 * - `angle`: Rotation angle (90/180/270)
 * - `background`: Background color for rotation
 *
 * ### Video Parameters
 * - `width/height/fit`: Same as images
 * - `codec`: Video codec - avc/hevc/vp8/vp9/av1
 * - `bitrate`: Video bitrate in bits per second
 * - `frameRate`: Frame rate in Hz
 * - `keyFrameInterval`: Key frame interval in seconds
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
class MediaTransformer {
    private readonly imageTransformer: ImageTransformer;

    private readonly videoTransformer: VideoTransformer;

    private readonly audioTransformer: AudioTransformer;

    private readonly config: Required<MediaTransformerConfig>;

    private readonly logger: Logger;

    public constructor(
        private readonly storage: BaseStorage<any, FileReturn>,
        config: MediaTransformerConfig = {},
    ) {
        this.logger = config.logger || this.storage.logger || console;

        this.config = {
            cacheTtl: 3600, // 1 hour
            defaultAudioBitrate: 128_000, // 128 kbps
            defaultAudioCodec: "aac",
            defaultVideoBitrate: 2_000_000, // 2 Mbps
            defaultVideoCodec: "avc",
            enableCache: false,
            logger: this.logger,
            maxAudioSize: 100 * 1024 * 1024, // 100MB
            maxImageSize: 10 * 1024 * 1024, // 10MB
            maxVideoSize: 500 * 1024 * 1024, // 500MB
            saveTransformedFiles: false, // Save transformed files to storage
            supportedAudioFormats: ["mp3", "wav", "ogg", "aac", "flac", "m4a", "wma", "aiff"],
            supportedImageFormats: ["jpeg", "png", "webp", "avif", "tiff", "gif", "svg"],
            supportedVideoFormats: ["mp4", "webm", "mkv", "avi", "mov", "flv", "wmv"],
            ...config,
        };

        // Initialize individual transformers with appropriate configs
        this.imageTransformer = new ImageTransformer(this.storage, {
            cacheTtl: this.config.cacheTtl,
            enableCache: this.config.enableCache,
            logger: this.config.logger,
            maxImageSize: this.config.maxImageSize,
            supportedFormats: this.config.supportedImageFormats,
        });

        this.videoTransformer = new VideoTransformer(this.storage, {
            cacheTtl: this.config.cacheTtl,
            defaultBitrate: this.config.defaultVideoBitrate,
            defaultCodec: this.config.defaultVideoCodec,
            enableCache: this.config.enableCache,
            logger: this.config.logger,
            maxVideoSize: this.config.maxVideoSize,
            supportedFormats: this.config.supportedVideoFormats,
        });

        this.audioTransformer = new AudioTransformer(this.storage, {
            cacheTtl: this.config.cacheTtl,
            defaultBitrate: this.config.defaultAudioBitrate,
            defaultCodec: this.config.defaultAudioCodec,
            enableCache: this.config.enableCache,
            logger: this.config.logger,
            maxAudioSize: this.config.maxAudioSize,
            supportedFormats: this.config.supportedAudioFormats,
        });
    }

    /**
     * Handle media transformation based on query parameters
     * @param fileId File identifier
     * @param query Query parameters for transformation
     * @returns Unified transformation result
     */
    public async handle(fileId: string, query: MediaTransformQuery | URLSearchParams | string): Promise<MediaTransformResult> {
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
                result = await this.handleAudioTransformation(fileId, parsedQuery);
                break;
            }
            case "image": {
                result = await this.handleImageTransformation(fileId, parsedQuery);
                break;
            }
            case "video": {
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
     * Handle image transformation
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
        const result = steps.length > 0 ? await this.imageTransformer.transform(fileId, steps) : await this.imageTransformer.transform(fileId, []); // No transformations

        // Convert to unified result format
        return this.convertImageResult(result);
    }

    /**
     * Handle video transformation
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
        const result = steps.length > 0 ? await this.videoTransformer.transform(fileId, steps) : await this.videoTransformer.transform(fileId, []); // No transformations

        // Convert to unified result format
        return this.convertVideoResult(result);
    }

    /**
     * Handle audio transformation
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
        const result = steps.length > 0 ? await this.audioTransformer.transform(fileId, steps) : await this.audioTransformer.transform(fileId, []); // No transformations

        // Convert to unified result format
        return this.convertAudioResult(result);
    }

    /**
     * Parse query parameters from various input formats
     */
    private parseQuery(query: MediaTransformQuery | URLSearchParams | string): MediaTransformQuery {
        if (typeof query === "string") {
            // Parse as URL query string
            const parameters = new URLSearchParams(query);

            return this.parseURLSearchParams(parameters);
        }

        if (query instanceof URLSearchParams) {
            return this.parseURLSearchParams(query);
        }

        // Already parsed object
        return query;
    }

    /**
     * Parse URLSearchParams into MediaTransformQuery
     */
    private parseURLSearchParams(parameters: URLSearchParams): MediaTransformQuery {
        const query: MediaTransformQuery = {};

        // Parse common parameters
        if (parameters.has("format"))
            query.format = parameters.get("format")!;

        if (parameters.has("quality"))
            query.quality = Number.parseInt(parameters.get("quality")!, 10);

        // Parse image/video parameters
        if (parameters.has("width"))
            query.width = Number.parseInt(parameters.get("width")!, 10);

        if (parameters.has("height"))
            query.height = Number.parseInt(parameters.get("height")!, 10);

        if (parameters.has("fit"))
            query.fit = parameters.get("fit") as any;

        if (parameters.has("position")) {
            const position = parameters.get("position")!;

            query.position = isNaN(Number(position)) ? position : Number.parseInt(position, 10);
        }

        if (parameters.has("withoutEnlargement"))
            query.withoutEnlargement = parameters.get("withoutEnlargement") === "true";

        if (parameters.has("withoutReduction"))
            query.withoutReduction = parameters.get("withoutReduction") === "true";

        // Parse crop parameters
        if (parameters.has("left"))
            query.left = Number.parseInt(parameters.get("left")!, 10);

        if (parameters.has("top"))
            query.top = Number.parseInt(parameters.get("top")!, 10);

        if (parameters.has("cropWidth"))
            query.cropWidth = Number.parseInt(parameters.get("cropWidth")!, 10);

        if (parameters.has("cropHeight"))
            query.cropHeight = Number.parseInt(parameters.get("cropHeight")!, 10);

        // Parse rotation parameters
        if (parameters.has("angle"))
            query.angle = Number.parseInt(parameters.get("angle")!, 10) as any;

        if (parameters.has("background"))
            query.background = parameters.get("background")!;

        // Parse video parameters
        if (parameters.has("codec"))
            query.codec = parameters.get("codec") as any;

        if (parameters.has("bitrate"))
            query.bitrate = Number.parseInt(parameters.get("bitrate")!, 10);

        if (parameters.has("frameRate"))
            query.frameRate = Number.parseInt(parameters.get("frameRate")!, 10);

        if (parameters.has("keyFrameInterval"))
            query.keyFrameInterval = Number.parseInt(parameters.get("keyFrameInterval")!, 10);

        // Parse audio parameters
        if (parameters.has("numberOfChannels"))
            query.numberOfChannels = Number.parseInt(parameters.get("numberOfChannels")!, 10);

        if (parameters.has("sampleRate"))
            query.sampleRate = Number.parseInt(parameters.get("sampleRate")!, 10);

        return query;
    }

    /**
     * Detect media type from MIME type
     */
    private detectMediaType(contentType: string | undefined): "image" | "video" | "audio" {
        if (!contentType) {
            throw new Error("Cannot detect media type: no content type provided");
        }

        if (contentType.startsWith("image/")) {
            return "image";
        }

        if (contentType.startsWith("video/")) {
            return "video";
        }

        if (contentType.startsWith("audio/")) {
            return "audio";
        }

        throw new Error(`Unsupported content type: ${contentType}`);
    }

    /**
     * Check if query has image transformations
     */
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
            || query.angle
            || query.background
            || query.format
            || query.quality
        );
    }

    /**
     * Check if query has video transformations
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
     */
    private hasAudioTransformations(query: MediaTransformQuery): boolean {
        return !!(query.sampleRate || query.numberOfChannels || query.codec || query.bitrate || query.format || query.quality);
    }

    /**
     * Convert ImageTransformer result to unified format
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

    /**
     * Clear cache for a specific file across all transformers
     */
    public clearCache(fileId?: string): void {
        this.imageTransformer.clearCache(fileId);
        this.videoTransformer.clearCache(fileId);
        this.audioTransformer.clearCache(fileId);
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
            audio: this.audioTransformer.getCacheStats(),
            image: this.imageTransformer.getCacheStats(),
            video: this.videoTransformer.getCacheStats(),
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
            "angle",
            "background",
            "cropHeight",
            "cropWidth",
            "fit",
            "format",
            "height",
            "left",
            "position",
            "quality",
            "top",
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
            const sortedInvalidParameters = [...invalidParameters].sort();

            throw new ValidationError(
                `Invalid query parameters for image transformation: ${sortedInvalidParameters.join(", ")}. `
                + `Images support: ${[...allowedParameters].sort().join(", ")}. `
                + `Video/audio parameters (${sortedInvalidParameters.join(", ")}) are not supported for images.`,
                "INVALID_PARAMS_FOR_IMAGE",
                "image",
                sortedInvalidParameters,
                [...allowedParameters].sort(),
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

        if (query.angle && ![90, 180, 270].includes(query.angle)) {
            throw new ValidationError(
                `Invalid angle value: ${query.angle}. Supported values: 90, 180, 270`,
                "INVALID_ANGLE_VALUE",
                "image",
                ["angle"],
                ["90", "180", "270"],
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
            const sortedInvalidParameters = [...invalidParameters].sort();

            throw new ValidationError(
                `Invalid query parameters for video transformation: ${sortedInvalidParameters.join(", ")}. `
                + `Videos support: ${[...allowedParameters].sort().join(", ")}. `
                + `Audio-only parameters (${sortedInvalidParameters.join(", ")}) are not supported for videos.`,
                "INVALID_PARAMS_FOR_VIDEO",
                "video",
                sortedInvalidParameters,
                [...allowedParameters].sort(),
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

        if (query.angle && ![90, 180, 270].includes(query.angle)) {
            throw new ValidationError(
                `Invalid angle value: ${query.angle}. Supported values: 90, 180, 270`,
                "INVALID_ANGLE_VALUE",
                "video",
                ["angle"],
                ["90", "180", "270"],
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
     */
    private generateTransformedFileId(originalFileId: string, query: MediaTransformQuery, mediaType: string): string {
        // Create a deterministic hash of the transformation parameters
        const transformParameters = Object.keys(query)
            .filter((key) => query[key as keyof MediaTransformQuery] !== undefined)
            .sort()
            .map((key) => `${key}:${query[key as keyof MediaTransformQuery]}`)
            .join("|");

        const hashInput = `${originalFileId}|${mediaType}|${transformParameters}`;
        const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

        return `${originalFileId}_transformed_${hash}`;
    }

    /**
     * Check if the query contains any transformations
     */
    private hasTransformations(query: MediaTransformQuery): boolean {
        return this.hasImageTransformations(query) || this.hasVideoTransformations(query) || this.hasAudioTransformations(query);
    }

    /**
     * Create a MediaTransformResult from a stored transformed file
     */
    private createMediaTransformResult(storedFile: FileReturn, mediaType: string, originalFile: FileReturn): MediaTransformResult {
        const baseResult = {
            buffer: storedFile.content,
            format: this.getFormatFromContentType(storedFile.contentType || ""),
            mediaType: mediaType as "image" | "video" | "audio",
            originalFile: originalFile as any,
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
     */
    private getFormatFromContentType(contentType: string): string {
        if (!contentType)
            return "";

        const parts = contentType.split("/");

        return parts.length > 1 ? parts[1]?.split(";")[0] || "" : "";
    }

    /**
     * Get appropriate content type for a format
     */
    private getContentTypeForFormat(format: string): string {
        const contentTypes: Record<string, string> = {
            aac: "audio/aac",
            aiff: "audio/aiff",
            avi: "video/x-msvideo",
            avif: "image/avif",
            flac: "audio/flac",
            flv: "video/x-flv",
            gif: "image/gif",
            // Images
            jpeg: "image/jpeg",
            jpg: "image/jpeg",
            m4a: "audio/mp4",
            mkv: "video/x-matroska",
            mov: "video/quicktime",
            // Audio
            mp3: "audio/mpeg",
            // Videos
            mp4: "video/mp4",
            ogg: "audio/ogg",
            png: "image/png",
            svg: "image/svg+xml",
            tiff: "image/tiff",
            wav: "audio/wav",
            webm: "video/webm",
            webp: "image/webp",
            wma: "audio/x-ms-wma",
            wmv: "video/x-ms-wmv",
        };

        return contentTypes[format.toLowerCase()] || "application/octet-stream";
    }

    /**
     * Save transformed file to storage
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
                    "content-type": this.getContentTypeForFormat(result.format),
                },
            } as any;

            // Save to storage
            await this.storage.create(mockRequest, {
                contentType: this.getContentTypeForFormat(result.format),
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
            const sortedInvalidParameters = [...invalidParameters].sort();

            throw new ValidationError(
                `Invalid query parameters for audio transformation: ${sortedInvalidParameters.join(", ")}. `
                + `Audio supports: ${[...allowedParameters].sort().join(", ")}. `
                + `Video-only parameters (${sortedInvalidParameters.join(", ")}) are not supported for audio.`,
                "INVALID_PARAMS_FOR_AUDIO",
                "audio",
                sortedInvalidParameters,
                [...allowedParameters].sort(),
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
}

export default MediaTransformer;
