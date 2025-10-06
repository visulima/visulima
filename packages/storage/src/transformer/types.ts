import type BaseStorage from "../storage/storage";
import type { File, FileReturn } from "../storage/utils/file";
import type { Logger } from "../utils/types";
import type BaseTransformer from "./base-transformer";

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
 * Image transformation result
 */
export interface TransformResult<TFileReturn extends FileReturn = FileReturn> {
    /** Transformed image buffer */
    buffer: Buffer;
    /** Image format */
    format: string;
    /** Image height in pixels */
    height: number;
    /** Original file information */
    originalFile: TFileReturn;
    /** Image size in bytes */
    size: number;
    /** Image width in pixels */
    width: number;
}

/**
 * Video transformation result
 */
export interface VideoTransformResult<TFileReturn extends FileReturn = FileReturn> extends TransformResult<TFileReturn> {
    /** Video bitrate */
    bitrate?: number;
    /** Video duration in seconds */
    duration: number;
}

/**
 * Audio transformation result
 */
export interface AudioTransformResult<TFileReturn extends FileReturn = FileReturn> extends Omit<TransformResult<TFileReturn>, "width" | "height"> {
    /** Audio bitrate */
    bitrate?: number;
    /** Audio duration in seconds */
    duration: number;
    /** Number of channels */
    numberOfChannels: number;
    /** Sample rate in Hz */
    sampleRate: number;
}

/**
 * Media transformer configuration (unified config for all transformers)
 */
export interface MediaTransformerConfig<TFile extends File = File, TFileReturn extends FileReturn = FileReturn> {
    /** Default audio bitrate */
    audioBitrate?: number;
    /** Default audio codec */
    audioCodec?: "aac" | "opus" | "mp3" | "vorbis" | "flac";
    /** Audio transformer class (optional, enables audio transformations) */
    AudioTransformer?: new (
        storage: BaseStorage<TFile, TFileReturn>,
        config: AudioTransformerConfig,
    ) => BaseTransformer<AudioTransformerConfig, AudioTransformResult<TFileReturn>, TFile, TFileReturn>;
    /** Cache TTL in seconds */
    cacheTtl?: number;
    /** Cache transformed media */
    enableCache?: boolean;
    /** Image transformer class (optional, enables image transformations) */
    ImageTransformer?: new (
        storage: BaseStorage<TFile, TFileReturn>,
        config: ImageTransformerConfig,
    ) => BaseTransformer<ImageTransformerConfig, TransformResult<TFileReturn>, TFile, TFileReturn>;
    /** Logger instance */
    logger?: Logger;
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
    /** Default video bitrate */
    videoBitrate?: number;
    /** Default video codec */
    videoCodec?: "avc" | "hevc" | "vp8" | "vp9" | "av1";
    /** Video transformer class (optional, enables video transformations) */
    VideoTransformer?: new (
        storage: BaseStorage<TFile, TFileReturn>,
        config: VideoTransformerConfig,
    ) => BaseTransformer<VideoTransformerConfig, VideoTransformResult<TFileReturn>, TFile, TFileReturn>;
}

/**
 * Unified media transformation result
 */
export interface MediaTransformResult<TFileReturn extends FileReturn = FileReturn> {
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
    originalFile: TFileReturn;
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
 * Base transformer configuration with common properties
 */
export interface BaseTransformerConfig {
    /** Cache TTL in seconds */
    cacheTtl?: number;
    /** Cache transformed files */
    enableCache?: boolean;
    /** Logger instance */
    logger?: Logger;
    /** Maximum number of cached items */
    maxCacheSize?: number;
    /** Supported input formats */
    supportedFormats?: string[];
}

/**
 * Image transformer configuration
 */
export interface ImageTransformerConfig extends BaseTransformerConfig {
    /** Maximum image size to process (in bytes) */
    maxImageSize?: number;
}

/**
 * Video transformer configuration
 */
export interface VideoTransformerConfig extends BaseTransformerConfig {
    /** Default video bitrate */
    defaultBitrate?: number;
    /** Default video codec */
    defaultCodec?: "avc" | "hevc" | "vp8" | "vp9" | "av1";
    /** Maximum video size to process (in bytes) */
    maxVideoSize?: number;
}

/**
 * Audio transformer configuration
 */
export interface AudioTransformerConfig extends BaseTransformerConfig {
    /** Default audio bitrate */
    defaultBitrate?: number;
    /** Default audio codec */
    defaultCodec?: "aac" | "opus" | "mp3" | "vorbis" | "flac";
    /** Maximum audio size to process (in bytes) */
    maxAudioSize?: number;
}
