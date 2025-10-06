import type { FileQuery } from "../storage/utils/file";

/**
 * Image transformation options
 */
export interface TransformOptions {
    /** Quality of alpha layer for WebP (0-100) */
    alphaQuality?: number;
    /** Compression level for PNG (0-9) */
    compressionLevel?: number;
    /** GIF delay(s) between animation frames (in milliseconds) */
    delay?: number;
    /** Effort for AVIF encoding (0-10) */
    effort?: number;
    /** Output format */
    format?: "jpeg" | "png" | "webp" | "avif" | "tiff" | "gif";
    /** GIF number of animation iterations, use 0 for infinite */
    loop?: number;
    /** Whether to use lossless compression for WebP */
    lossless?: boolean;
    /** Whether to use progressive encoding for JPEG */
    progressive?: boolean;
    /** Quality for JPEG/WebP images (1-100) */
    quality?: number;
}

/**
 * Resize transformation options
 */
export interface ResizeOptions extends TransformOptions {
    /** Background color for fill fit */
    background?: string;
    /** Resize fit mode */
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    /** Height in pixels */
    height?: number;
    /** Position for cover/contain fits */
    position?: string | number;
    /** Width in pixels */
    width?: number;
    /** Whether to avoid enlarging images smaller than specified dimensions */
    withoutEnlargement?: boolean;
    /** Whether to avoid reducing images larger than specified dimensions */
    withoutReduction?: boolean;
}

/**
 * Crop transformation options
 */
export interface CropOptions extends TransformOptions {
    /** Crop area height */
    height: number;
    /** Crop area left offset */
    left: number;
    /** Crop area top offset */
    top: number;
    /** Crop area width */
    width: number;
}

/**
 * Rotate transformation options
 */
export interface RotateOptions extends TransformOptions {
    /** Rotation angle in degrees (90, 180, 270) */
    angle: 90 | 180 | 270;
    /** Background color for rotation */
    background?: string;
}

/**
 * Transformation pipeline step
 */
export interface TransformationStep {
    options: TransformOptions | ResizeOptions | CropOptions | RotateOptions;
    type: "resize" | "crop" | "rotate" | "format" | "quality";
}

/**
 * Generic transformation pipeline step (for any media type)
 */
export interface MediaTransformationStep {
    options:
        | TransformOptions
        | ResizeOptions
        | CropOptions
        | RotateOptions
        | VideoTransformOptions
        | VideoResizeOptions
        | VideoCropOptions
        | VideoRotateOptions
        | AudioTransformOptions
        | AudioChannelMixOptions
        | AudioResampleOptions;
    type: "resize" | "crop" | "rotate" | "format" | "quality" | "codec" | "bitrate" | "frameRate" | "resample" | "channels";
}

/**
 * Image transformation result
 */
export interface TransformResult {
    /** Transformed image buffer */
    buffer: Buffer;
    /** Image format */
    format: string;
    /** Image height in pixels */
    height: number;
    /** Original file information */
    originalFile: FileQuery;
    /** Image size in bytes */
    size: number;
    /** Image width in pixels */
    width: number;
}

/**
 * Video transformation options
 */
export interface VideoTransformOptions extends TransformOptions {
    /** Video bitrate */
    bitrate?: number;
    /** Video codec */
    codec?: "avc" | "hevc" | "vp8" | "vp9" | "av1";
    /** Frame rate in Hz */
    frameRate?: number;
    /** Key frame interval in seconds */
    keyFrameInterval?: number;
}

/**
 * Audio transformation options
 */
export interface AudioTransformOptions extends TransformOptions {
    /** Audio bitrate */
    bitrate?: number;
    /** Audio codec */
    codec?: "aac" | "opus" | "mp3" | "vorbis" | "flac";
    /** Number of channels */
    numberOfChannels?: number;
    /** Sample rate in Hz */
    sampleRate?: number;
}

/**
 * Video resize transformation options
 */
export interface VideoResizeOptions extends VideoTransformOptions {
    /** Resize fit mode */
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    /** Height in pixels */
    height?: number;
    /** Position for cover/contain fits */
    position?: string | number;
    /** Width in pixels */
    width?: number;
    /** Whether to avoid enlarging videos smaller than specified dimensions */
    withoutEnlargement?: boolean;
    /** Whether to avoid reducing videos larger than specified dimensions */
    withoutReduction?: boolean;
}

/**
 * Video crop transformation options
 */
export interface VideoCropOptions extends VideoTransformOptions {
    /** Crop area height */
    height: number;
    /** Crop area left offset */
    left: number;
    /** Crop area top offset */
    top: number;
    /** Crop area width */
    width: number;
}

/**
 * Video rotate transformation options
 */
export interface VideoRotateOptions extends VideoTransformOptions {
    /** Rotation angle in degrees (90, 180, 270) */
    angle: 90 | 180 | 270;
    /** Background color for rotation */
    background?: string;
}

/**
 * Audio channel mix transformation options
 */
export interface AudioChannelMixOptions extends AudioTransformOptions {
    /** Number of output channels */
    numberOfChannels: number;
}

/**
 * Audio resample transformation options
 */
export interface AudioResampleOptions extends AudioTransformOptions {
    /** Output sample rate in Hz */
    sampleRate: number;
}

/**
 * Video transformation pipeline step
 */
export interface VideoTransformationStep {
    options: VideoTransformOptions | VideoResizeOptions | VideoCropOptions | VideoRotateOptions;
    type: "resize" | "crop" | "rotate" | "format" | "codec" | "bitrate" | "frameRate";
}

/**
 * Audio transformation pipeline step
 */
export interface AudioTransformationStep {
    options: AudioTransformOptions | AudioChannelMixOptions | AudioResampleOptions;
    type: "resample" | "channels" | "format" | "codec" | "bitrate";
}

/**
 * Video transformation result
 */
export interface VideoTransformResult {
    /** Video bitrate */
    bitrate?: number;
    /** Transformed video buffer */
    buffer: Buffer;
    /** Video duration in seconds */
    duration: number;
    /** Video format */
    format: string;
    /** Video height in pixels */
    height: number;
    /** Original file information */
    originalFile: FileQuery;
    /** Video size in bytes */
    size: number;
    /** Video width in pixels */
    width: number;
}

/**
 * Audio transformation result
 */
export interface AudioTransformResult {
    /** Audio bitrate */
    bitrate?: number;
    /** Transformed audio buffer */
    buffer: Buffer;
    /** Audio duration in seconds */
    duration: number;
    /** Audio format */
    format: string;
    /** Number of channels */
    numberOfChannels: number;
    /** Original file information */
    originalFile: FileQuery;
    /** Sample rate in Hz */
    sampleRate: number;
    /** Audio size in bytes */
    size: number;
}

/**
 * Video transformer configuration
 */
export interface VideoTransformerConfig {
    /** Cache TTL in seconds */
    cacheTtl?: number;
    /** Default video bitrate */
    defaultBitrate?: number;
    /** Default video codec */
    defaultCodec?: "avc" | "hevc" | "vp8" | "vp9" | "av1";
    /** Cache transformed videos */
    enableCache?: boolean;
    /** Logger instance */
    logger?: import("../utils/types").Logger;
    /** Maximum video size to process (in bytes) */
    maxVideoSize?: number;
    /** Supported input formats */
    supportedFormats?: string[];
}

/**
 * Audio transformer configuration
 */
export interface AudioTransformerConfig {
    /** Cache TTL in seconds */
    cacheTtl?: number;
    /** Default audio bitrate */
    defaultBitrate?: number;
    /** Default audio codec */
    defaultCodec?: "aac" | "opus" | "mp3" | "vorbis" | "flac";
    /** Cache transformed audio */
    enableCache?: boolean;
    /** Logger instance */
    logger?: import("../utils/types").Logger;
    /** Maximum audio size to process (in bytes) */
    maxAudioSize?: number;
    /** Supported input formats */
    supportedFormats?: string[];
}

/**
 * Media transformer configuration (unified config for all transformers)
 */
export interface MediaTransformerConfig {
    /** Cache TTL in seconds */
    cacheTtl?: number;
    /** Default audio bitrate */
    defaultAudioBitrate?: number;
    /** Default audio codec */
    defaultAudioCodec?: "aac" | "opus" | "mp3" | "vorbis" | "flac";
    /** Default video bitrate */
    defaultVideoBitrate?: number;
    /** Default video codec */
    defaultVideoCodec?: "avc" | "hevc" | "vp8" | "vp9" | "av1";
    /** Cache transformed media */
    enableCache?: boolean;
    /** Logger instance */
    logger?: import("../utils/types").Logger;
    /** Maximum audio size to process (in bytes) */
    maxAudioSize?: number;
    /** Maximum image size to process (in bytes) */
    maxImageSize?: number;
    /** Maximum video size to process (in bytes) */
    maxVideoSize?: number;
    /** Save transformed files to storage for reuse */
    saveTransformedFiles?: boolean;
    /** Supported audio input formats */
    supportedAudioFormats?: string[];
    /** Supported image input formats */
    supportedImageFormats?: string[];
    /** Supported video input formats */
    supportedVideoFormats?: string[];
}

/**
 * Unified media transformation result
 */
export interface MediaTransformResult {
    /** Video-specific properties */
    bitrate?: number;
    /** Transformed media buffer */
    buffer: Buffer;
    /** Video/Audio-specific properties */
    duration?: number;
    /** Media format */
    format: string;
    /** Image/Video-specific properties */
    height?: number;
    /** Media type */
    mediaType: "image" | "video" | "audio";
    /** Audio-specific properties */
    numberOfChannels?: number;
    /** Original file information */
    originalFile: FileQuery;
    /** Audio-specific properties */
    sampleRate?: number;
    /** Media size in bytes */
    size: number;
    /** Image-specific properties */
    width?: number;
}

/**
 * Query parameters for media transformation
 */
export interface MediaTransformQuery {
    /** Rotation angle in degrees */
    angle?: 90 | 180 | 270;
    /** Background color for rotation */
    background?: string;

    /** Video bitrate in bits per second */
    bitrate?: number;
    // Video-specific parameters
    /** Video codec */
    codec?: "avc" | "hevc" | "vp8" | "vp9" | "av1" | "aac" | "opus" | "mp3" | "vorbis" | "flac";
    /** Crop area height */
    cropHeight?: number;
    /** Crop area width */
    cropWidth?: number;
    /** Resize fit mode */
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    // Common parameters
    /** Output format */
    format?: string;
    /** Frame rate in Hz */
    frameRate?: number;
    /** Height in pixels */
    height?: number;
    /** Key frame interval in seconds */
    keyFrameInterval?: number;
    /** Crop area left offset */
    left?: number;
    // Audio-specific parameters
    /** Number of channels */
    numberOfChannels?: number;
    /** Position for cover/contain fits */
    position?: string | number;

    /** Quality (0-100 for images, bitrate for video/audio) */
    quality?: number;
    /** Sample rate in Hz */
    sampleRate?: number;
    /** Crop area top offset */
    top?: number;
    // Image-specific parameters
    /** Width in pixels */
    width?: number;

    /** Whether to avoid enlarging smaller images */
    withoutEnlargement?: boolean;
    /** Whether to avoid reducing larger images */
    withoutReduction?: boolean;
}

/**
 * Image transformer configuration
 */
export interface ImageTransformerConfig {
    /** Cache TTL in seconds */
    cacheTtl?: number;
    /** Cache transformed images */
    enableCache?: boolean;
    /** Logger instance */
    logger?: import("../utils/types").Logger;
    /** Maximum image size to process (in bytes) */
    maxImageSize?: number;
    /** Supported input formats */
    supportedFormats?: string[];
}
