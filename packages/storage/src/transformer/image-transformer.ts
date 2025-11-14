import { Readable } from "node:stream";

import type { Sharp } from "sharp";
import sharp from "sharp";

import type BaseStorage from "../storage/storage";
import type { File, FileQuery, FileReturn } from "../storage/utils/file";
import BaseTransformer from "./base-transformer";
import type {
    AffineOptions,
    BandboolOptions,
    BlurOptions,
    BooleanOptions,
    CLAHEOptions,
    ColourspaceOptions,
    ConvolveOptions,
    CropOptions,
    DilateOptions,
    EnsureAlphaOptions,
    ErodeOptions,
    ExtractChannelOptions,
    GreyscaleOptions,
    ImageTransformerConfig,
    JoinChannelOptions,
    LinearOptions,
    MedianOptions,
    ModulateOptions,
    PipelineColourspaceOptions,
    RecombineOptions,
    RemoveAlphaOptions,
    ResizeOptions,
    RotateOptions,
    SharpenOptions,
    ThresholdOptions,
    TintOptions,
    ToColourspaceOptions,
    TransformationStep,
    TransformOptions,
    TransformResult,
} from "./types";
import { getFormatFromContentType, isValidMediaType } from "./utils";

/**
 * Image transformer that uses storage backends to retrieve and transform images
 *
 * Supports URL-based transformations with query parameters for on-demand image processing.
 * @example
 * ```ts
 * const transformer = new ImageTransformer(storage, {
 *   maxImageSize: 10 * 1024 * 1024, // 10MB
 *   cache: new Map()
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
    /**
     * Creates a new ImageTransformer instance.
     * @param storage The storage backend for retrieving and storing image files
     * @param config Configuration options for image transformation including cache settings and size limits
     */
    public constructor(storage: BaseStorage<TFile, TFileReturn>, config: ImageTransformerConfig = {}) {
        const logger = config.logger || storage.logger;

        const transformerConfig = {
            cacheTtl: 3600, // 1 hour
            maxCacheSize: 100, // Max 100 transformed images in cache
            maxImageSize: 50 * 1024 * 1024, // 50MB
            supportedFormats: ["jpeg", "png", "webp", "avif", "tiff", "gif", "svg"],
            ...config,
        } satisfies ImageTransformerConfig;

        super(storage, transformerConfig, logger);
    }

    /**
     * Resize an image to specified dimensions with optional fit mode.
     * @param fileId Unique identifier of the image file to resize
     * @param options Resize options including width, height, and fit mode
     * @returns Promise resolving to transformed image result
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
     * Apply sharpening to an image
     */
    public async sharpen(fileId: string, options: SharpenOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "sharpen" }]);
    }

    /**
     * Apply blurring to an image
     */
    public async blur(fileId: string, options: BlurOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "blur" }]);
    }

    /**
     * Apply median filter to an image
     */
    public async median(fileId: string, options: MedianOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "median" }]);
    }

    /**
     * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to an image
     */
    public async clahe(fileId: string, options: CLAHEOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "clahe" }]);
    }

    /**
     * Apply convolution to an image
     */
    public async convolve(fileId: string, options: ConvolveOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "convolve" }]);
    }

    /**
     * Apply thresholding to an image
     */
    public async threshold(fileId: string, options: ThresholdOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "threshold" }]);
    }

    /**
     * Apply boolean operation to an image
     */
    public async boolean(fileId: string, options: BooleanOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "boolean" }]);
    }

    /**
     * Apply linear transformation to an image
     */
    public async linear(fileId: string, options: LinearOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "linear" }]);
    }

    /**
     * Apply recombine transformation to an image
     */
    public async recombine(fileId: string, options: RecombineOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "recombine" }]);
    }

    /**
     * Apply modulation to an image
     */
    public async modulate(fileId: string, options: ModulateOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "modulate" }]);
    }

    /**
     * Apply tinting to an image
     */
    public async tint(fileId: string, options: TintOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "tint" }]);
    }

    /**
     * Convert image to greyscale
     */
    public async greyscale(fileId: string, options: GreyscaleOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "greyscale" }]);
    }

    /**
     * Convert image colourspace
     */
    public async colourspace(fileId: string, options: ColourspaceOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "colourspace" }]);
    }

    /**
     * Extract a channel from an image
     */
    public async extractChannel(fileId: string, options: ExtractChannelOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "extractChannel" }]);
    }

    /**
     * Join channels to an image
     */
    public async joinChannel(fileId: string, options: JoinChannelOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "joinChannel" }]);
    }

    /**
     * Apply band boolean operation to an image
     */
    public async bandbool(fileId: string, options: BandboolOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "bandbool" }]);
    }

    /**
     * Auto-orient an image based on EXIF data
     */
    public async autoOrient(fileId: string, options: TransformOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "autoOrient" }]);
    }

    /**
     * Flip an image vertically
     */
    public async flip(fileId: string, options: TransformOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "flip" }]);
    }

    /**
     * Flop an image horizontally
     */
    public async flop(fileId: string, options: TransformOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "flop" }]);
    }

    /**
     * Flatten image alpha channel
     */
    public async flatten(fileId: string, options: TransformOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "flatten" }]);
    }

    /**
     * Unflatten image alpha channel
     */
    public async unflatten(fileId: string, options: TransformOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "unflatten" }]);
    }

    /**
     * Apply gamma correction to an image
     */
    public async gamma(fileId: string, options: TransformOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "gamma" }]);
    }

    /**
     * Negate (invert) an image
     */
    public async negate(fileId: string, options: TransformOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "negate" }]);
    }

    /**
     * Normalise an image
     */
    public async normalise(fileId: string, options: TransformOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "normalise" }]);
    }

    /**
     * Apply affine transformation to an image
     */
    public async affine(fileId: string, options: AffineOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "affine" }]);
    }

    /**
     * Apply dilation to an image
     */
    public async dilate(fileId: string, options: DilateOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "dilate" }]);
    }

    /**
     * Apply erosion to an image
     */
    public async erode(fileId: string, options: ErodeOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "erode" }]);
    }

    /**
     * Set pipeline colourspace for an image
     */
    public async pipelineColourspace(fileId: string, options: PipelineColourspaceOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "pipelineColourspace" }]);
    }

    /**
     * Convert colourspace of an image
     */
    public async toColourspace(fileId: string, options: ToColourspaceOptions): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "toColourspace" }]);
    }

    /**
     * Remove alpha channel from an image
     */
    public async removeAlpha(fileId: string, options: RemoveAlphaOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "removeAlpha" }]);
    }

    /**
     * Ensure alpha channel in an image
     */
    public async ensureAlpha(fileId: string, options: EnsureAlphaOptions = {}): Promise<TransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "ensureAlpha" }]);
    }

    /**
     * Apply a custom transformation pipeline
     */
    public async transform(fileId: string, steps: TransformationStep[]): Promise<TransformResult<TFileReturn>> {
        const fileQuery: FileQuery = { id: fileId };
        const cacheKey = this.generateCacheKey(fileId, steps);

        const cached = this.cache.get(cacheKey);

        if (cached) {
            this.logger?.debug("Returning cached transformed image for %s", fileId);

            return cached;
        }

        // Get original image from storage
        const originalFile = await this.storage.get(fileQuery);

        // Validate image
        await this.validateImage(originalFile);

        // Apply transformations
        const transformedBuffer = await this.applyTransformations(originalFile.content, steps);

        const result = await this.createTransformResult(transformedBuffer, originalFile);

        // Cache the result
        if (this.cache) {
            this.cache.set(cacheKey, result);
        }

        return result;
    }

    /**
     * Stream transform a file (for large files, falls back to regular transform)
     */
    public override async transformStream(
        fileId: string,
        steps: TransformationStep[],
    ): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        // For image transformations, we need the full image data, so we fall back to regular transform
        // and then stream the result. True streaming would require a different approach.
        const result = await this.transform(fileId, steps);

        return {
            headers: {
                "Content-Length": result.buffer.length.toString(),
                "Content-Type": this.getContentTypeFromResult(result),
                "X-Image-Height": result.height?.toString(),
                "X-Image-Width": result.width?.toString(),
            },
            size: result.buffer.length,
            stream: Readable.from(result.buffer),
        };
    }

    /**
     * Apply multiple transformations in sequence using Sharp
     * @param buffer The original image buffer
     * @param steps Array of transformation steps to apply
     * @returns Promise resolving to transformed image buffer
     * @private
     */
    private async applyTransformations(buffer: Buffer, steps: TransformationStep[]): Promise<Buffer> {
        let sharpInstance: Sharp = sharp(buffer);

        for (const step of steps) {
            switch (step.type) {
                case "affine": {
                    sharpInstance = this.applyAffine(sharpInstance, step.options as AffineOptions);
                    break;
                }
                case "autoOrient": {
                    sharpInstance = sharpInstance.rotate();
                    break;
                }
                case "bandbool": {
                    sharpInstance = this.applyBandbool(sharpInstance, step.options as BandboolOptions);
                    break;
                }
                case "blur": {
                    sharpInstance = this.applyBlur(sharpInstance, step.options as BlurOptions);
                    break;
                }
                case "boolean": {
                    sharpInstance = this.applyBoolean(sharpInstance, step.options as BooleanOptions);
                    break;
                }
                case "clahe": {
                    sharpInstance = this.applyCLAHE(sharpInstance, step.options as CLAHEOptions);
                    break;
                }
                case "colourspace": {
                    sharpInstance = this.applyColourspace(sharpInstance, step.options as ColourspaceOptions);
                    break;
                }
                case "convolve": {
                    sharpInstance = this.applyConvolve(sharpInstance, step.options as ConvolveOptions);
                    break;
                }
                case "crop": {
                    sharpInstance = this.applyCrop(sharpInstance, step.options as CropOptions);
                    break;
                }
                case "dilate": {
                    sharpInstance = this.applyDilate(sharpInstance, step.options as DilateOptions);
                    break;
                }
                case "ensureAlpha": {
                    sharpInstance = this.applyEnsureAlpha(sharpInstance, step.options as EnsureAlphaOptions);
                    break;
                }
                case "erode": {
                    sharpInstance = this.applyErode(sharpInstance, step.options as ErodeOptions);
                    break;
                }
                case "extractChannel": {
                    sharpInstance = this.applyExtractChannel(sharpInstance, step.options as ExtractChannelOptions);
                    break;
                }
                case "flatten": {
                    sharpInstance = sharpInstance.flatten();
                    break;
                }
                case "flip": {
                    sharpInstance = sharpInstance.flip();
                    break;
                }
                case "flop": {
                    sharpInstance = sharpInstance.flop();
                    break;
                }
                case "format":
                case "quality": {
                    sharpInstance = this.applyFormatAndQuality(sharpInstance, step.options);
                    break;
                }
                case "gamma": {
                    sharpInstance = sharpInstance.gamma();
                    break;
                }
                case "greyscale": {
                    sharpInstance = this.applyGreyscale(sharpInstance, step.options as GreyscaleOptions);
                    break;
                }
                case "joinChannel": {
                    sharpInstance = this.applyJoinChannel(sharpInstance, step.options as JoinChannelOptions);
                    break;
                }
                case "linear": {
                    sharpInstance = this.applyLinear(sharpInstance, step.options as LinearOptions);
                    break;
                }
                case "median": {
                    sharpInstance = this.applyMedian(sharpInstance, step.options as MedianOptions);
                    break;
                }
                case "modulate": {
                    sharpInstance = this.applyModulate(sharpInstance, step.options as ModulateOptions);
                    break;
                }
                case "negate": {
                    sharpInstance = sharpInstance.negate();
                    break;
                }
                case "normalise":
                case "normalize": {
                    sharpInstance = sharpInstance.normalise();
                    break;
                }
                case "pipelineColourspace": {
                    sharpInstance = this.applyPipelineColourspace(sharpInstance, step.options as PipelineColourspaceOptions);
                    break;
                }
                case "recombine": {
                    sharpInstance = this.applyRecombine(sharpInstance, step.options as RecombineOptions);
                    break;
                }
                case "removeAlpha": {
                    sharpInstance = this.applyRemoveAlpha(sharpInstance, step.options as RemoveAlphaOptions);
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
                case "sharpen": {
                    sharpInstance = this.applySharpen(sharpInstance, step.options as SharpenOptions);
                    break;
                }
                case "threshold": {
                    sharpInstance = this.applyThreshold(sharpInstance, step.options as ThresholdOptions);
                    break;
                }
                case "tint": {
                    sharpInstance = this.applyTint(sharpInstance, step.options as TintOptions);
                    break;
                }
                case "toColourspace": {
                    sharpInstance = this.applyToColourspace(sharpInstance, step.options as ToColourspaceOptions);
                    break;
                }
                case "unflatten": {
                    sharpInstance = sharpInstance.unflatten();
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
     * Apply resize transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Resize transformation options
     * @returns Modified Sharp instance with resize applied
     * @private
     */
    private applyResize(sharpInstance: Sharp, options: ResizeOptions): Sharp {
        const {
            background,
            fastShrinkOnLoad,
            fit = "cover",
            height,
            kernel,
            position,
            width,
            withoutEnlargement,
            withoutReduction,
            ...formatOptions
        } = options;

        let resizeOptions: any = {
            background: background || "transparent",
            fastShrinkOnLoad,
            fit,
            height,
            kernel,
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
     * Apply crop transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Crop transformation options
     * @returns Modified Sharp instance with crop applied
     * @private
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
     * Apply rotate transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Rotate transformation options
     * @returns Modified Sharp instance with rotation applied
     * @private
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
     * Apply sharpen transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Sharpen transformation options
     * @returns Modified Sharp instance with sharpening applied
     * @private
     */
    private applySharpen(sharpInstance: Sharp, options: SharpenOptions): Sharp {
        const { sigma, ...formatOptions } = options;

        const sharpenOptions: any = {};

        if (sigma !== undefined) {
            sharpenOptions.sigma = sigma;
        }

        let sharpenInstance = sharpInstance.sharpen(sharpenOptions);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            sharpenInstance = this.applyFormatAndQuality(sharpenInstance, formatOptions);
        }

        return sharpenInstance;
    }

    /**
     * Apply blur transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Blur transformation options
     * @returns Modified Sharp instance with blurring applied
     * @private
     */
    private applyBlur(sharpInstance: Sharp, options: BlurOptions): Sharp {
        const { sigma, ...formatOptions } = options;

        let blurInstance = sharpInstance.blur(sigma === undefined ? true : sigma);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            blurInstance = this.applyFormatAndQuality(blurInstance, formatOptions);
        }

        return blurInstance;
    }

    /**
     * Apply median filter using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Median transformation options
     * @returns Modified Sharp instance with median filter applied
     * @private
     */
    private applyMedian(sharpInstance: Sharp, options: MedianOptions): Sharp {
        const { size, ...formatOptions } = options;

        let medianInstance = sharpInstance.median(size);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            medianInstance = this.applyFormatAndQuality(medianInstance, formatOptions);
        }

        return medianInstance;
    }

    /**
     * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options CLAHE transformation options
     * @returns Modified Sharp instance with CLAHE applied
     * @private
     */
    private applyCLAHE(sharpInstance: Sharp, options: CLAHEOptions): Sharp {
        const { height, maxSlope, width, ...formatOptions } = options;

        let claheInstance = sharpInstance.clahe({
            height,
            maxSlope,
            width,
        } as Required<CLAHEOptions>);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            claheInstance = this.applyFormatAndQuality(claheInstance, formatOptions);
        }

        return claheInstance;
    }

    /**
     * Apply convolution using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Convolution transformation options
     * @returns Modified Sharp instance with convolution applied
     * @private
     */
    private applyConvolve(sharpInstance: Sharp, options: ConvolveOptions): Sharp {
        const { height, kernel, offset, scale, width, ...formatOptions } = options;

        let convolveInstance = sharpInstance.convolve({
            height,
            kernel,
            offset,
            scale,
            width,
        } as Required<ConvolveOptions>);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            convolveInstance = this.applyFormatAndQuality(convolveInstance, formatOptions);
        }

        return convolveInstance;
    }

    /**
     * Apply threshold using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Threshold transformation options
     * @returns Modified Sharp instance with thresholding applied
     * @private
     */
    private applyThreshold(sharpInstance: Sharp, options: ThresholdOptions): Sharp {
        const { grayscale, greyscale, threshold = 128, ...formatOptions } = options;

        let thresholdInstance = sharpInstance.threshold(threshold, {
            greyscale: greyscale || grayscale,
        });

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            thresholdInstance = this.applyFormatAndQuality(thresholdInstance, formatOptions);
        }

        return thresholdInstance;
    }

    /**
     * Apply boolean operation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Boolean operation options
     * @returns Modified Sharp instance with boolean operation applied
     * @private
     */
    private applyBoolean(sharpInstance: Sharp, options: BooleanOptions): Sharp {
        const { operand, operator, raw, ...formatOptions } = options;

        let booleanInstance = sharpInstance.boolean(operand, operator, raw as any);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            booleanInstance = this.applyFormatAndQuality(booleanInstance, formatOptions);
        }

        return booleanInstance;
    }

    /**
     * Apply linear transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Linear transformation options
     * @returns Modified Sharp instance with linear transformation applied
     * @private
     */
    private applyLinear(sharpInstance: Sharp, options: LinearOptions): Sharp {
        const { a, b, ...formatOptions } = options;

        let linearInstance = sharpInstance.linear(a, b);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            linearInstance = this.applyFormatAndQuality(linearInstance, formatOptions);
        }

        return linearInstance;
    }

    /**
     * Apply recombine transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Recombine transformation options
     * @returns Modified Sharp instance with recombine applied
     * @private
     */
    private applyRecombine(sharpInstance: Sharp, options: RecombineOptions): Sharp {
        const { matrix, ...formatOptions } = options;

        let recombineInstance = sharpInstance.recomb(matrix.flat() as any);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            recombineInstance = this.applyFormatAndQuality(recombineInstance, formatOptions);
        }

        return recombineInstance;
    }

    /**
     * Apply modulate transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Modulate transformation options
     * @returns Modified Sharp instance with modulation applied
     * @private
     */
    private applyModulate(sharpInstance: Sharp, options: ModulateOptions): Sharp {
        const { brightness, hue, lightness, saturation, ...formatOptions } = options;

        let modulateInstance = sharpInstance.modulate({
            brightness,
            hue,
            lightness,
            saturation,
        });

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            modulateInstance = this.applyFormatAndQuality(modulateInstance, formatOptions);
        }

        return modulateInstance;
    }

    /**
     * Apply tint using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Tint transformation options
     * @returns Modified Sharp instance with tinting applied
     * @private
     */
    private applyTint(sharpInstance: Sharp, options: TintOptions): Sharp {
        const { rgb, ...formatOptions } = options;

        let tintInstance = sharpInstance.tint(Array.isArray(rgb) ? rgb : (rgb as any));

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            tintInstance = this.applyFormatAndQuality(tintInstance, formatOptions);
        }

        return tintInstance;
    }

    /**
     * Apply greyscale conversion using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Greyscale transformation options
     * @returns Modified Sharp instance converted to greyscale
     * @private
     */
    private applyGreyscale(sharpInstance: Sharp, options: GreyscaleOptions): Sharp {
        const { grayscale, greyscale, ...formatOptions } = options;

        let greyscaleInstance = sharpInstance.greyscale(greyscale || grayscale);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            greyscaleInstance = this.applyFormatAndQuality(greyscaleInstance, formatOptions);
        }

        return greyscaleInstance;
    }

    /**
     * Apply colourspace conversion using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Colourspace transformation options
     * @returns Modified Sharp instance with colourspace conversion
     * @private
     */
    private applyColourspace(sharpInstance: Sharp, options: ColourspaceOptions): Sharp {
        const { colourspace, ...formatOptions } = options;

        let colourspaceInstance = sharpInstance.toColourspace(colourspace);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            colourspaceInstance = this.applyFormatAndQuality(colourspaceInstance, formatOptions);
        }

        return colourspaceInstance;
    }

    /**
     * Extract channel using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Channel extraction options
     * @returns Modified Sharp instance with channel extracted
     * @private
     */
    private applyExtractChannel(sharpInstance: Sharp, options: ExtractChannelOptions): Sharp {
        const { channel, ...formatOptions } = options;

        let extractInstance = sharpInstance.extractChannel(channel as any);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            extractInstance = this.applyFormatAndQuality(extractInstance, formatOptions);
        }

        return extractInstance;
    }

    /**
     * Join channels using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Channel joining options
     * @returns Modified Sharp instance with channels joined
     * @private
     */
    private applyJoinChannel(sharpInstance: Sharp, options: JoinChannelOptions): Sharp {
        const { images, ...formatOptions } = options;

        let joinInstance = sharpInstance.joinChannel(images);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            joinInstance = this.applyFormatAndQuality(joinInstance, formatOptions);
        }

        return joinInstance;
    }

    /**
     * Apply band boolean operation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Band boolean options
     * @returns Modified Sharp instance with band boolean operation applied
     * @private
     */
    private applyBandbool(sharpInstance: Sharp, options: BandboolOptions): Sharp {
        const { operator, ...formatOptions } = options;

        let bandboolInstance = sharpInstance.bandbool(operator);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            bandboolInstance = this.applyFormatAndQuality(bandboolInstance, formatOptions);
        }

        return bandboolInstance;
    }

    /**
     * Apply affine transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Affine transformation options
     * @returns Modified Sharp instance with affine transformation applied
     * @private
     */
    private applyAffine(sharpInstance: Sharp, options: AffineOptions): Sharp {
        const { background, interpolation, matrix, ...formatOptions } = options;

        let affineInstance = sharpInstance.affine(matrix as any, {
            background: background || "transparent",
            interpolator: interpolation || "bicubic",
        });

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            affineInstance = this.applyFormatAndQuality(affineInstance, formatOptions);
        }

        return affineInstance;
    }

    /**
     * Apply dilation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Dilate options
     * @returns Modified Sharp instance with dilation applied
     * @private
     */
    private applyDilate(sharpInstance: Sharp, options: DilateOptions): Sharp {
        const { kernelSize, ...formatOptions } = options;

        let dilateInstance = kernelSize ? sharpInstance.dilate(kernelSize) : sharpInstance.dilate();

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            dilateInstance = this.applyFormatAndQuality(dilateInstance, formatOptions);
        }

        return dilateInstance;
    }

    /**
     * Apply erosion using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Erode options
     * @returns Modified Sharp instance with erosion applied
     * @private
     */
    private applyErode(sharpInstance: Sharp, options: ErodeOptions): Sharp {
        const { kernelSize, ...formatOptions } = options;

        let erodeInstance = kernelSize ? sharpInstance.erode(kernelSize) : sharpInstance.erode();

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            erodeInstance = this.applyFormatAndQuality(erodeInstance, formatOptions);
        }

        return erodeInstance;
    }

    /**
     * Apply pipeline colourspace using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Pipeline colourspace options
     * @returns Modified Sharp instance with pipeline colourspace applied
     * @private
     */
    private applyPipelineColourspace(sharpInstance: Sharp, options: PipelineColourspaceOptions): Sharp {
        const { colourspace, ...formatOptions } = options;

        let colourspaceInstance = sharpInstance.pipelineColourspace(colourspace);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            colourspaceInstance = this.applyFormatAndQuality(colourspaceInstance, formatOptions);
        }

        return colourspaceInstance;
    }

    /**
     * Apply to colourspace using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options To colourspace options
     * @returns Modified Sharp instance with colourspace conversion applied
     * @private
     */
    private applyToColourspace(sharpInstance: Sharp, options: ToColourspaceOptions): Sharp {
        const { colourspace, ...formatOptions } = options;

        let colourspaceInstance = sharpInstance.toColourspace(colourspace);

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            colourspaceInstance = this.applyFormatAndQuality(colourspaceInstance, formatOptions);
        }

        return colourspaceInstance;
    }

    /**
     * Apply remove alpha using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Remove alpha options
     * @returns Modified Sharp instance with alpha channel removed
     * @private
     */
    private applyRemoveAlpha(sharpInstance: Sharp, options: RemoveAlphaOptions): Sharp {
        const { background, ...formatOptions } = options;

        let alphaInstance = sharpInstance.removeAlpha();

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            alphaInstance = this.applyFormatAndQuality(alphaInstance, formatOptions);
        }

        return alphaInstance;
    }

    /**
     * Apply ensure alpha using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Ensure alpha options
     * @returns Modified Sharp instance with alpha channel ensured
     * @private
     */
    private applyEnsureAlpha(sharpInstance: Sharp, options: EnsureAlphaOptions): Sharp {
        const { alpha, ...formatOptions } = options;

        let alphaInstance = sharpInstance.ensureAlpha();

        // Apply format and quality options
        if (Object.keys(formatOptions).length > 0) {
            alphaInstance = this.applyFormatAndQuality(alphaInstance, formatOptions);
        }

        return alphaInstance;
    }

    /**
     * Apply format and quality transformation using Sharp
     * @param sharpInstance The Sharp instance to modify
     * @param options Format and quality transformation options
     * @returns Modified Sharp instance with format and quality settings applied
     * @private
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
     * Get format-specific options for Sharp
     * @param options Transform options containing format-specific settings
     * @returns Record of format options for Sharp processing
     * @private
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
     * @param file The file to validate
     * @returns Promise that resolves if validation passes
     * @throws Error if file size exceeds limits, wrong content type, unsupported format, or invalid image
     * @private
     */
    private async validateImage(file: TFileReturn): Promise<void> {
        // Check file size
        const fileSize = typeof file.size === "string" ? Number.parseInt(file.size, 10) : file.size;

        if (this.config?.maxImageSize && fileSize > this.config.maxImageSize) {
            throw new Error(`Image size ${fileSize} exceeds maximum allowed size ${this.config.maxImageSize}`);
        }

        // Check if it's an image
        if (!isValidMediaType(file.contentType, "image")) {
            throw new Error(`File is not an image: ${file.contentType}`);
        }

        // Check format support
        const format = getFormatFromContentType(file.contentType);

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
     * Create transformation result with metadata
     * @param buffer The transformed image buffer
     * @param originalFile The original file information
     * @returns Image transformation result with metadata
     * @private
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
     * @param fileId The file identifier
     * @param steps Array of transformation steps
     * @returns Unique cache key string
     * @private
     */
    private generateCacheKey(fileId: string, steps: TransformationStep[]): string {
        const stepsKey = steps.map((step) => `${step.type}:${JSON.stringify(step.options)}`).join("|");

        return `${fileId}:${stepsKey}`;
    }
}

export default ImageTransformer;
