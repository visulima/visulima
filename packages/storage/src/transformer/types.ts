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
 * Sharpen transformation options
 */
export interface SharpenOptions extends TransformOptions {
    /** M1 for sharpen formula */
    m1?: number;
    /** M2 for sharpen formula */
    m2?: number;
    /** Sigma for Gaussian blur */
    sigma?: number;
    /** X1 for sharpen formula */
    x1?: number;
    /** Y2 for sharpen formula */
    y2?: number;
    /** Y3 for sharpen formula */
    y3?: number;
}

/**
 * Blur transformation options
 */
export interface BlurOptions extends TransformOptions {
    /** M1 for blur formula */
    m1?: number;
    /** M2 for blur formula */
    m2?: number;
    /** Sigma for Gaussian blur */
    sigma?: number;
    /** X1 for blur formula */
    x1?: number;
    /** Y2 for blur formula */
    y2?: number;
    /** Y3 for blur formula */
    y3?: number;
}

/**
 * Median transformation options
 */
export interface MedianOptions extends TransformOptions {
    /** Size of the median filter */
    size?: number;
}

/**
 * CLAHE (Contrast Limited Adaptive Histogram Equalization) options
 */
export interface CLAHEOptions extends TransformOptions {
    /** Height of the tile grid */
    height?: number;
    /** Maximum slope value for contrast limiting */
    maxSlope?: number;
    /** Width of the tile grid */
    width?: number;
}

/**
 * Convolve transformation options
 */
export interface ConvolveOptions extends TransformOptions {
    /** Height of the kernel in pixels */
    height?: number;
    /** Kernel values as flat array */
    kernel?: number[];
    /** Offset value */
    offset?: number;
    /** Scale factor */
    scale?: number;
    /** Width of the kernel in pixels */
    width?: number;
}

/**
 * Threshold transformation options
 */
export interface ThresholdOptions extends TransformOptions {
    /** Alternative spelling for greyscale */
    grayscale?: boolean;
    /** Convert to greyscale */
    greyscale?: boolean;
    /** Threshold value (0-255) */
    threshold?: number;
}

/**
 * Boolean operation options
 */
export interface BooleanOptions extends TransformOptions {
    /** Operand image buffer or path */
    operand: Buffer | string;
    /** Boolean operation: and, or, eor */
    operator: "and" | "or" | "eor";
    /** Raw operand options */
    raw?: {
        channels: number;
        height: number;
        width: number;
    };
}

/**
 * Linear transformation options
 */
export interface LinearOptions extends TransformOptions {
    /** Multiplier values (per channel or single value) */
    a?: number | number[];
    /** Offset values (per channel or single value) */
    b?: number | number[];
}

/**
 * Recombine transformation options
 */
export interface RecombineOptions extends TransformOptions {
    /** 3x3 or 4x4 recombination matrix */
    matrix: number[][];
}

/**
 * Modulate transformation options
 */
export interface ModulateOptions extends TransformOptions {
    /** Brightness multiplier */
    brightness?: number;
    /** Hue rotation in degrees */
    hue?: number;
    /** Lightness adjustment */
    lightness?: number;
    /** Saturation multiplier */
    saturation?: number;
}

/**
 * Tint transformation options
 */
export interface TintOptions extends TransformOptions {
    /** RGB tint values */
    rgb: [number, number, number] | string;
}

/**
 * Greyscale transformation options
 */
export interface GreyscaleOptions extends TransformOptions {
    /** Alternative spelling */
    grayscale?: boolean;
    /** Convert to greyscale */
    greyscale?: boolean;
}

/**
 * Colourspace transformation options
 */
export interface ColourspaceOptions extends TransformOptions {
    /** Target colourspace */
    colourspace: "srgb" | "rgb" | "cmyk" | "lab" | "b-w";
}

/**
 * Channel extraction options
 */
export interface ExtractChannelOptions extends TransformOptions {
    /** Channel to extract (0-3 for RGBA) */
    channel: number;
}

/**
 * Channel join options
 */
export interface JoinChannelOptions extends TransformOptions {
    /** Images to join as channels */
    images: (Buffer | string)[];
}

/**
 * Band boolean options
 */
export interface BandboolOptions extends TransformOptions {
    /** Boolean operation: and, or, eor */
    operator: "and" | "or" | "eor";
}

/**
 * Affine transformation options
 */
export interface AffineOptions extends TransformOptions {
    /** 2x3 transformation matrix */
    matrix: [number, number, number, number, number, number];
    /** Background color for areas outside the transformed image */
    background?: string;
    /** Interpolation method */
    interpolation?: "nearest" | "bilinear" | "bicubic" | "nohalo" | "lbb" | "vsqbs";
}

/**
 * Dilate options
 */
export interface DilateOptions extends TransformOptions {
    /** Kernel size for dilation */
    kernelSize?: number;
}

/**
 * Erode options
 */
export interface ErodeOptions extends TransformOptions {
    /** Kernel size for erosion */
    kernelSize?: number;
}

/**
 * Pipeline colourspace options
 */
export interface PipelineColourspaceOptions extends TransformOptions {
    /** Colourspace for internal operations */
    colourspace: "rgb" | "srgb" | "cmyk" | "lab" | "b-w";
}

/**
 * To colourspace options
 */
export interface ToColourspaceOptions extends TransformOptions {
    /** Target colourspace */
    colourspace: "srgb" | "rgb" | "cmyk" | "lab" | "b-w";
}

/**
 * Remove alpha channel options
 */
export interface RemoveAlphaOptions extends TransformOptions {
    /** Background color to composite over alpha channel */
    background?: string;
}

/**
 * Ensure alpha channel options
 */
export interface EnsureAlphaOptions extends TransformOptions {
    /** Alpha channel value to add */
    alpha?: number;
}

/**
 * Resize transformation options
 */
export interface ResizeOptions extends TransformOptions {
    /** Background color for fill fit */
    background?: string;
    /** Whether to skip enlargement during initial load */
    fastShrinkOnLoad?: boolean;
    /** Resize fit mode */
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    /** Height in pixels */
    height?: number;
    /** Resize kernel */
    kernel?: "nearest" | "cubic" | "mitchell" | "lanczos2" | "lanczos3";
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
    /** Rotation angle in degrees. Note: angles other than 90°, 180°, and 270° require interpolation and may affect image quality */
    angle: number;
    /** Background color for rotation */
    background?: string;
}

/**
 * Transformation pipeline step
 */
export interface TransformationStep {
    options:
        | TransformOptions
        | ResizeOptions
        | CropOptions
        | RotateOptions
        | SharpenOptions
        | BlurOptions
        | MedianOptions
        | CLAHEOptions
        | ConvolveOptions
        | ThresholdOptions
        | BooleanOptions
        | LinearOptions
        | RecombineOptions
        | ModulateOptions
        | TintOptions
        | GreyscaleOptions
        | ColourspaceOptions
        | ExtractChannelOptions
        | JoinChannelOptions
        | BandboolOptions
        | AffineOptions
        | DilateOptions
        | ErodeOptions
        | PipelineColourspaceOptions
        | ToColourspaceOptions
        | RemoveAlphaOptions
        | EnsureAlphaOptions;
    type:
        | "resize"
        | "crop"
        | "rotate"
        | "format"
        | "quality"
        | "sharpen"
        | "blur"
        | "median"
        | "clahe"
        | "convolve"
        | "threshold"
        | "boolean"
        | "linear"
        | "recombine"
        | "modulate"
        | "tint"
        | "greyscale"
        | "colourspace"
        | "extractChannel"
        | "joinChannel"
        | "bandbool"
        | "autoOrient"
        | "flip"
        | "flop"
        | "affine"
        | "dilate"
        | "erode"
        | "pipelineColourspace"
        | "toColourspace"
        | "removeAlpha"
        | "ensureAlpha"
        | "flatten"
        | "unflatten"
        | "gamma"
        | "negate"
        | "normalise"
        | "normalize";
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
        | SharpenOptions
        | BlurOptions
        | MedianOptions
        | CLAHEOptions
        | ConvolveOptions
        | ThresholdOptions
        | BooleanOptions
        | LinearOptions
        | RecombineOptions
        | ModulateOptions
        | TintOptions
        | GreyscaleOptions
        | ColourspaceOptions
        | ExtractChannelOptions
        | JoinChannelOptions
        | BandboolOptions
        | VideoTransformOptions
        | VideoResizeOptions
        | VideoCropOptions
        | VideoRotateOptions
        | AudioTransformOptions
        | AudioChannelMixOptions
        | AudioResampleOptions;
    type:
        | "resize"
        | "crop"
        | "rotate"
        | "format"
        | "quality"
        | "sharpen"
        | "blur"
        | "median"
        | "clahe"
        | "convolve"
        | "threshold"
        | "boolean"
        | "linear"
        | "recombine"
        | "modulate"
        | "tint"
        | "greyscale"
        | "colourspace"
        | "extractChannel"
        | "joinChannel"
        | "bandbool"
        | "autoOrient"
        | "flip"
        | "flop"
        | "affine"
        | "dilate"
        | "erode"
        | "flatten"
        | "unflatten"
        | "gamma"
        | "negate"
        | "normalise"
        | "normalize"
        | "codec"
        | "bitrate"
        | "frameRate"
        | "resample"
        | "channels";
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
    /** Rotation angle in degrees. Note: angles other than 90°, 180°, and 270° require interpolation and may affect video quality */
    angle: number;
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
    /** Rotation angle in degrees. Note: angles other than 90°, 180°, and 270° require interpolation and may affect media quality */
    angle?: number;
    /** Background color for rotation */
    background?: string;
    /** Video bitrate in bits per second */
    bitrate?: number;
    /** Apply blur effect */
    blur?: boolean;
    /** Brightness multiplier for modulation */
    brightness?: number;
    /** Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) */
    clahe?: boolean;
    // Video-specific parameters
    /** Video codec */
    codec?: "avc" | "hevc" | "vp8" | "vp9" | "av1" | "aac" | "opus" | "mp3" | "vorbis" | "flac";
    /** Crop area height */
    cropHeight?: number;
    /** Crop area width */
    cropWidth?: number;
    /** Fast shrink on load */
    fastShrinkOnLoad?: boolean;
    /** Resize fit mode */
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    /** Flatten alpha channel */
    flatten?: boolean;
    /** Flip image vertically */
    flip?: boolean;
    /** Flop image horizontally */
    flop?: boolean;
    // Common parameters
    /** Output format */
    format?: string;
    /** Frame rate in Hz */
    frameRate?: number;
    /** Apply gamma correction */
    gamma?: boolean;
    /** Convert to greyscale */
    greyscale?: boolean;
    /** Height in pixels */
    height?: number;
    /** Hue rotation in degrees for modulation */
    hue?: number;
    /** Resize kernel */
    kernel?: string;
    /** Key frame interval in seconds */
    keyFrameInterval?: number;
    /** Crop area left offset */
    left?: number;

    /** Lightness adjustment for modulation */
    lightness?: number;
    /** Apply median filter with specified size */
    median?: number;
    /** Apply modulation effects */
    modulate?: boolean;
    /** Apply affine transformation */
    affine?: boolean;
    /** Apply dilation */
    dilate?: boolean;
    /** Apply erosion */
    erode?: boolean;
    /** Set pipeline colourspace */
    pipelineColourspace?: boolean;
    /** Convert to colourspace */
    toColourspace?: boolean;
    /** Remove alpha channel */
    removeAlpha?: boolean;
    /** Ensure alpha channel */
    ensureAlpha?: boolean;
    /** Negate (invert) the image */
    negate?: boolean;
    /** Normalise the image */
    normalise?: boolean;
    // Audio-specific parameters
    /** Number of channels */
    numberOfChannels?: number;
    /** Position for cover/contain fits */
    position?: string | number;
    /** Quality (0-100 for images, bitrate for video/audio) */
    quality?: number;
    /** Sample rate in Hz */
    sampleRate?: number;
    /** Saturation multiplier for modulation */
    saturation?: number;
    /** Apply sharpening */
    sharpen?: boolean;
    /** Apply thresholding with specified value */
    threshold?: number;

    /** Apply tinting */
    tint?: boolean;
    /** Crop area top offset */
    top?: number;
    /** Unflatten alpha channel */
    unflatten?: boolean;
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
    supportedFormats?: string[] | undefined;
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
