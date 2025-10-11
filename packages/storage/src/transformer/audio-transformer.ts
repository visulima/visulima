import {
    AdtsOutputFormat,
    ALL_FORMATS,
    BufferSource,
    BufferTarget,
    Conversion,
    FlacOutputFormat,
    Input,
    Mp3OutputFormat,
    OggOutputFormat,
    Output,
    WavOutputFormat,
} from "mediabunny";

import type BaseStorage from "../storage/storage";
import type { File, FileQuery, FileReturn } from "../storage/utils/file";
import BaseTransformer from "./base-transformer";
import type {
    AudioChannelMixOptions,
    AudioResampleOptions,
    AudioTransformationStep,
    AudioTransformerConfig,
    AudioTransformOptions,
    AudioTransformResult,
} from "./types";
import { getFormatFromContentType, isValidMediaType } from "./utils";

/**
 * Audio transformer that uses storage backends and Mediabunny to retrieve and transform audio files
 *
 * Supports audio transformations with query parameters for on-demand audio processing.
 * @example
 * ```ts
 * const transformer = new AudioTransformer(storage, {
 *   maxAudioSize: 50 * 1024 * 1024, // 50MB
 *   cache: new Map()
 * });
 *
 * // Programmatic usage - resample audio
 * const result = await transformer.resample('audio-id', {
 *   sampleRate: 44100
 * });
 *
 * // URL-based transformations
 * // GET /files/audio-id?sampleRate=48000&codec=aac&bitrate=128000
 * // GET /files/audio-id?numberOfChannels=1&format=mp3
 * ```
 *
 * ## Supported Query Parameters
 *
 * - `sampleRate`: Sample rate in Hz (Number)
 * - `numberOfChannels`: Number of channels (Number)
 * - `codec`: Audio codec - aac/opus/mp3/vorbis/flac
 * - `bitrate`: Audio bitrate in bits per second (Number)
 * - `format`: Output format - mp3/wav/ogg/aac/flac
 */
class AudioTransformer<TFile extends File = File, TFileReturn extends FileReturn = FileReturn> extends BaseTransformer<
    AudioTransformerConfig,
    AudioTransformResult<TFileReturn>,
    TFile,
    TFileReturn
> {
    /**
     * Creates a new AudioTransformer instance
     * @param storage The storage backend for retrieving and storing audio files
     * @param config Configuration options for audio transformation including cache settings, codec defaults, and size limits
     */
    public constructor(storage: BaseStorage<TFile, TFileReturn>, config: AudioTransformerConfig = {}) {
        const logger = config.logger || storage.logger;

        const transformerConfig = {
            cacheTtl: 3600, // 1 hour
            defaultBitrate: 128_000, // 128 kbps
            defaultCodec: "aac" as const,
            maxAudioSize: 100 * 1024 * 1024, // 100MB
            maxCacheSize: 100, // Max 100 transformed audio files in cache
            supportedFormats: ["mp3", "wav", "ogg", "aac", "flac", "m4a", "wma", "aiff"],
            ...config,
        } satisfies AudioTransformerConfig;

        super(storage, transformerConfig, logger);
    }

    /**
     * Resample audio to different sample rate
     */
    public async resample(fileId: string, options: AudioResampleOptions): Promise<AudioTransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "resample" }]);
    }

    /**
     * Change number of channels (up/downmixing)
     */
    public async mixChannels(fileId: string, options: AudioChannelMixOptions): Promise<AudioTransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options, type: "channels" }]);
    }

    /**
     * Convert audio format or codec
     */
    public async convertFormat(fileId: string, format: string, options: AudioTransformOptions = {}): Promise<AudioTransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options: { ...options, format: format as any }, type: "format" }]);
    }

    /**
     * Transcode audio to different codec
     */
    public async transcode(
        fileId: string,
        codec: AudioTransformOptions["codec"],
        options: Omit<AudioTransformOptions, "codec"> = {},
    ): Promise<AudioTransformResult<TFileReturn>> {
        return this.transform(fileId, [{ options: { ...options, codec }, type: "codec" }]);
    }

    /**
     * Apply a custom transformation pipeline
     */
    public async transform(fileId: string, steps: AudioTransformationStep[]): Promise<AudioTransformResult<TFileReturn>> {
        const fileQuery: FileQuery = { id: fileId };
        const cacheKey = this.generateCacheKey(fileId, steps);


        // Check cache first
        if (this.cache) {
            const cached = this.cache.get(cacheKey);

            if (cached) {
                this.logger?.debug("Returning cached transformed audio for %s", fileId);

                return cached;
            }
        }

        // Get original audio from storage
        const originalFile = await this.storage.get(fileQuery);

        // Validate audio
        await this.validateAudio(originalFile);

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
     */
    private async applyTransformations(buffer: Buffer, steps: AudioTransformationStep[]): Promise<Buffer> {
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

        // Convert transformation steps to Mediabunny audio options
        const audioOptions = this.stepsToAudioOptions(steps);

        // Create and execute conversion
        const conversion = await Conversion.init({
            audio: audioOptions,
            input,
            output,
        });

        if (!conversion.isValid) {
            const reasons = conversion.discardedTracks.map((track) => track.reason).join(", ");

            throw new Error(`Audio transformation failed: ${reasons}`);
        }

        await conversion.execute();

        return Buffer.from(output.target.buffer as ArrayBuffer);
    }

    /**
     * Convert transformation steps to Mediabunny audio options
     * @param steps Array of audio transformation steps to convert
     * @returns Mediabunny audio options object for conversion
     * @private
     */
    private stepsToAudioOptions(steps: AudioTransformationStep[]): any {
        const options: any = {};

        for (const step of steps) {
            switch (step.type) {
                case "bitrate": {
                    const bitrateOptions = step.options as AudioTransformOptions;

                    if (bitrateOptions.bitrate) {
                        options.bitrate = bitrateOptions.bitrate;
                    }

                    break;
                }
                case "channels": {
                    const channelOptions = step.options as AudioChannelMixOptions;

                    if (channelOptions.numberOfChannels) {
                        options.numberOfChannels = channelOptions.numberOfChannels;
                    }

                    break;
                }
                case "codec": {
                    const codecOptions = step.options as AudioTransformOptions;

                    if (codecOptions.codec) {
                        options.codec = codecOptions.codec;
                    }

                    if (codecOptions.bitrate) {
                        options.bitrate = codecOptions.bitrate;
                    }

                    break;
                }
                case "resample": {
                    const resampleOptions = step.options as AudioResampleOptions;

                    if (resampleOptions.sampleRate) {
                        options.sampleRate = resampleOptions.sampleRate;
                    }

                    break;
                }
            }
        }

        return options;
    }

    /**
     * Determine output format based on transformation steps
     * @param steps Array of audio transformation steps
     * @returns Mediabunny output format instance (defaults to MP3)
     * @private
     */
    private determineOutputFormat(steps: AudioTransformationStep[]): any {
        // Check if any step specifies a format
        for (const step of steps) {
            if (step.type === "format" && step.options.format) {
                return this.formatStringToOutputFormat(step.options.format as string);
            }
        }

        // Default to MP3 for audio
        return new Mp3OutputFormat();
    }

    /**
     * Convert format string to Mediabunny output format
     * @param format Audio format string (aac, flac, mp3, ogg, wav)
     * @returns Mediabunny output format instance
     * @private
     */
    private formatStringToOutputFormat(format: string): any {
        switch (format.toLowerCase()) {
            case "aac": {
                return new AdtsOutputFormat();
            }
            case "flac": {
                return new FlacOutputFormat();
            }
            case "mp3": {
                return new Mp3OutputFormat();
            }
            case "ogg": {
                return new OggOutputFormat();
            }
            case "wav": {
                return new WavOutputFormat();
            }
            default: {
                return new Mp3OutputFormat();
            }
        }
    }

    /**
     * Validate that the file is a supported audio file
     * @param file The file to validate
     * @returns Promise that resolves if validation passes
     * @throws Error if file size exceeds limits, wrong content type, unsupported format, or invalid audio
     * @private
     */
    private async validateAudio(file: TFileReturn): Promise<void> {
        // Check file size
        const fileSize = typeof file.size === "string" ? Number.parseInt(file.size, 10) : file.size;

        if (this.config?.maxAudioSize && fileSize > this.config.maxAudioSize) {
            throw new Error(`Audio size ${fileSize} exceeds maximum allowed size ${this.config.maxAudioSize}`);
        }

        // Check if it's audio
        if (!isValidMediaType(file.contentType, "audio")) {
            throw new Error(`File is not audio: ${file.contentType}`);
        }

        // Check format support
        const format = getFormatFromContentType(file.contentType);

        if (this.config?.supportedFormats && format && !this.config.supportedFormats.includes(format)) {
            throw new Error(`Unsupported audio format: ${format}`);
        }

        // Additional validation with Mediabunny
        try {
            const input = new Input({
                formats: ALL_FORMATS,
                source: new BufferSource(file.content),
            });

            const primaryTrack = await input.getPrimaryAudioTrack();

            if (!primaryTrack) {
                throw new Error("No audio track found");
            }
        } catch (error) {
            throw new Error(`Invalid audio file: ${error}`);
        }
    }

    /**
     * Create transformation result with metadata
     * @param buffer The transformed audio buffer
     * @param originalFile The original file information
     * @returns Audio transformation result with metadata
     * @private
     */
    private async createTransformResult(buffer: Buffer, originalFile: TFileReturn): Promise<AudioTransformResult<TFileReturn>> {
        // For now, return basic metadata. In a real implementation,
        // you might want to parse the transformed audio to get accurate metadata
        const input = new Input({
            formats: ALL_FORMATS,
            source: new BufferSource(buffer),
        });

        const audioTrack = await input.getPrimaryAudioTrack();
        const duration = await input.computeDuration();

        return {
            bitrate: this.config.defaultBitrate,
            buffer,
            duration,
            format: "mp3", // Default, would need to detect actual format
            numberOfChannels: audioTrack?.numberOfChannels || 2,
            originalFile,
            sampleRate: audioTrack?.sampleRate || 44_100,
            size: buffer.length,
        };
    }

    /**
     * Generate cache key for transformation
     * @param fileId The file identifier
     * @param steps Array of transformation steps
     * @returns Unique cache key string
     * @private
     */
    // eslint-disable-next-line class-methods-use-this
    private generateCacheKey(fileId: string, steps: AudioTransformationStep[]): string {
        const stepsKey = steps.map((step) => `${step.type}:${JSON.stringify(step.options)}`).join("|");

        return `${fileId}:${stepsKey}`;
    }
}

export default AudioTransformer;
