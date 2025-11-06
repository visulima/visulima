import { Buffer } from "node:buffer";

import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels, StringifyAwareReporter } from "../../types";
import type { AbstractJsonReporterOptions } from "../json/abstract-json-reporter";
import { AbstractJsonReporter } from "../json/abstract-json-reporter";
import compressData from "./utils/compression.js";
import LogSizeError from "./utils/log-size-error.js";
import sendWithRetry from "./utils/retry.js";

/**
 * Configuration options for the HTTP reporter.
 */
export type AbstractHttpReporterOptions = AbstractJsonReporterOptions & {
    /**
     * Content type for batch log requests. User-specified headers take precedence.
     * @default "application/json"
     */
    batchContentType?: string;

    /**
     * Field name to wrap batch entries in when batchMode is "field" (e.g., "batch" for Logflare)
     * @default undefined
     */
    batchFieldName?: string;

    /**
     * Batch mode for sending multiple log entries
     * - "delimiter": Join entries with a delimiter (default)
     * - "field": Wrap entries in an object with a field name
     * - "array": Send entries as a plain JSON array
     * @default "delimiter"
     */
    batchMode?: "delimiter" | "field" | "array";

    /**
     * Delimiter to use between log entries in batch mode
     * @default "\n"
     */
    batchSendDelimiter?: string;

    /**
     * Timeout in milliseconds for sending batches regardless of size
     * @default 5000
     */
    batchSendTimeout?: number;

    /**
     * Number of log entries to batch before sending
     * @default 100
     */
    batchSize?: number;

    /**
     * Whether to use gzip compression
     * @default false
     */
    compression?: boolean;

    /**
     * Content type for single log requests. User-specified headers take precedence.
     * @default "application/json"
     */
    contentType?: string;

    /**
     * Whether to enable Edge Runtime compatibility mode
     * When enabled, TextEncoder and compression are disabled
     * @default false
     */
    edgeCompat?: boolean;

    /**
     * Whether to enable batch sending
     * @default true
     */
    enableBatchSend?: boolean;

    /**
     * Headers to include in the request. Can be an object or a function that returns headers.
     */
    headers?: Record<string, string> | (() => Record<string, string>);

    /**
     * Maximum size of a single log entry in bytes
     * @default 1048576 (1MB)
     */
    maxLogSize?: number;

    /**
     * Maximum size of the payload (uncompressed) in bytes
     * @default 5242880 (5MB)
     */
    maxPayloadSize?: number;

    /**
     * Number of retry attempts before giving up
     * @default 3
     */
    maxRetries?: number;

    /**
     * HTTP method to use for requests
     * @default "POST"
     */
    method?: string;

    /**
     * Optional callback for debugging log entries before they are sent
     */
    onDebug?: (entry: Record<string, unknown>) => void;

    /**
     * Optional callback for debugging HTTP requests and responses
     */
    onDebugRequestResponse?: (requestResponse: {
        req: { body: string | Uint8Array; headers: Record<string, string>; method: string; url: string };
        res: { body: string; headers: Record<string, string>; status: number; statusText: string };
    }) => void;

    /**
     * Optional callback for error handling
     */
    onError?: (error: Error) => void;

    /**
     * Function to transform log data into the payload format.
     * By default, uses the JSON stringified log entry.
     */
    payloadTemplate?: (data: { data?: Record<string, unknown>; logLevel: string; message: string }) => string;

    /**
     * Whether to respect rate limiting by waiting when a 429 response is received
     * @default true
     */
    respectRateLimit?: boolean;

    /**
     * Base delay between retries in milliseconds
     * @default 1000
     */
    retryDelay?: number;

    /**
     * The URL to send logs to
     */
    url: string;
};

/**
 * Abstract HTTP Reporter.
 *
 * Base class for HTTP-based reporters that sends logs to HTTP endpoints.
 * Supports batching, compression, retries, and rate limiting.
 * @template L - The log level type
 */
export abstract class AbstractHttpReporter<L extends string = string> extends AbstractJsonReporter<L> implements StringifyAwareReporter<L> {
    protected url: string;

    protected method: string;

    protected headers: Record<string, string> | (() => Record<string, string>);

    protected contentType: string;

    protected batchContentType: string;

    protected onError?: (error: Error) => void;

    protected onDebug?: (entry: Record<string, unknown>) => void;

    protected onDebugRequestResponse?: (requestResponse: {
        req: { body: string | Uint8Array; headers: Record<string, string>; method: string; url: string };
        res: { body: string; headers: Record<string, string>; status: number; statusText: string };
    }) => void;

    protected payloadTemplate: (data: { data?: Record<string, unknown>; logLevel: string; message: string }) => string;

    protected compression: boolean;

    protected maxRetries: number;

    protected retryDelay: number;

    protected respectRateLimit: boolean;

    protected enableBatchSend: boolean;

    protected batchSize: number;

    protected batchSendTimeout: number;

    protected batchSendDelimiter: string;

    protected batchMode: "delimiter" | "field" | "array";

    protected batchFieldName?: string;

    protected maxLogSize: number;

    protected maxPayloadSize: number;

    protected edgeCompat: boolean;

    // Batch management
    protected batchQueue: string[] = [];

    protected batchTimeout?: ReturnType<typeof setTimeout>;

    protected isProcessingBatch = false;

    protected currentBatchSize = 0; // Track uncompressed size of current batch

    /**
     * Creates a new instance of AbstractHttpReporter.
     * @param config Configuration options for the reporter
     */
    public constructor(config: AbstractHttpReporterOptions) {
        super(config);

        this.url = config.url;
        this.method = config.method ?? "POST";
        this.headers = config.headers ?? {};
        this.contentType = config.contentType ?? "application/json";
        this.batchContentType = config.batchContentType ?? "application/json";
        this.onError = config.onError;
        this.onDebug = config.onDebug;
        this.onDebugRequestResponse = config.onDebugRequestResponse;
        this.payloadTemplate = config.payloadTemplate ?? ((data) => JSON.stringify(data));
        this.compression = config.compression ?? false;
        this.maxRetries = config.maxRetries ?? 3;
        this.retryDelay = config.retryDelay ?? 1000;
        this.respectRateLimit = config.respectRateLimit ?? true;
        this.enableBatchSend = config.enableBatchSend ?? true;
        this.batchSize = config.batchSize ?? 100;
        this.batchSendTimeout = config.batchSendTimeout ?? 5000;
        this.batchSendDelimiter = config.batchSendDelimiter ?? "\n";
        this.batchMode = config.batchMode ?? "delimiter";
        this.batchFieldName = config.batchFieldName;

        // Validate that batchFieldName is provided when batchMode is "field"
        if (this.batchMode === "field" && !this.batchFieldName) {
            throw new Error("batchFieldName is required when batchMode is 'field'");
        }

        this.maxLogSize = config.maxLogSize ?? 1_048_576; // 1MB
        this.maxPayloadSize = config.maxPayloadSize ?? 5_242_880; // 5MB
        this.edgeCompat = config.edgeCompat ?? false;
    }

    /**
     * Processes and ships log entries to the HTTP endpoint.
     * @param message The JSON-formatted log message
     * @param logLevel The log level of the message
     * @protected
     */
    // eslint-disable-next-line no-underscore-dangle
    protected override _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void {
        try {
            // Parse the JSON message to extract data for payload template
            const logData = JSON.parse(message) as Record<string, unknown>;
            const logLevelString = logLevel as string;
            const messageString = logData.message as string | undefined;

            const payloadTemplate = {
                logLevel: logLevelString,
                message: messageString ?? "",
            };

            if (logData.data) {
                payloadTemplate["data"] = logData.data;
            } else if (logData.context) {
                payloadTemplate["data"] = logData.context;
            } else {
                // Include all other fields as data
                const rest = { ...logData };

                delete rest.message;

                if (Object.keys(rest).length > 0) {
                    payloadTemplate["data"] = rest;
                }
            }

            const payload = this.payloadTemplate(payloadTemplate);

            if (this.onDebug) {
                this.onDebug({ data: payloadTemplate.data, logLevel: logLevelString, message: messageString });
            }

            // Check log entry size
            const logEntrySize
                = this.edgeCompat || typeof TextEncoder === "undefined" ? Buffer.byteLength(payload, "utf8") : new TextEncoder().encode(payload).length;

            if (logEntrySize > this.maxLogSize) {
                const error = new LogSizeError(
                    `Log entry exceeds maximum size of ${this.maxLogSize} bytes. Size: ${logEntrySize} bytes`,
                    { data: payloadTemplate.data, logLevel: logLevelString, message: messageString },
                    logEntrySize,
                    this.maxLogSize,
                );

                if (this.onError) {
                    this.onError(error);
                }

                return;
            }

            if (this.enableBatchSend) {
                this.addToBatch(payload, logEntrySize);
            } else {
                // Send immediately
                this.sendPayload(payload).catch((error) => {
                    if (this.onError) {
                        this.onError(error);
                    }
                });
            }
        } catch (error) {
            if (this.onError) {
                this.onError(error as Error);
            }
        }
    }

    /**
     * Adds a payload to the batch queue and triggers sending if conditions are met.
     */
    protected addToBatch(payload: string, logEntrySize: number): void {
        // Check if adding this entry would exceed payload size limit
        const payloadSizeWithEntry = this.currentBatchSize + logEntrySize + this.batchSendDelimiter.length;
        const payloadSizeThreshold = this.maxPayloadSize * 0.9; // 90% of max payload size

        // Force send if adding this entry would exceed 90% of max payload size
        if (payloadSizeWithEntry > payloadSizeThreshold && this.batchQueue.length > 0) {
            this.processBatch();
        }

        this.batchQueue.push(payload);
        this.currentBatchSize += logEntrySize + this.batchSendDelimiter.length;

        // Start batch timeout if not already running
        if (!this.batchTimeout) {
            this.batchTimeout = setTimeout(() => {
                this.processBatch();
            }, this.batchSendTimeout);
        }

        // Send immediately if batch size is reached
        if (this.batchQueue.length >= this.batchSize) {
            this.processBatch();
        }
    }

    /**
     * Processes the current batch and sends it to the HTTP endpoint.
     */
    protected async processBatch(): Promise<void> {
        if (this.isProcessingBatch || this.batchQueue.length === 0) {
            return;
        }

        this.isProcessingBatch = true;

        // Clear the timeout
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = undefined;
        }

        // Get the current batch
        const batch = this.batchQueue.splice(0, this.batchSize);

        // Recalculate batch size for remaining items in queue
        this.currentBatchSize = 0;

        for (let i = 0; i < this.batchQueue.length; i += 1) {
            const payload = this.batchQueue[i];
            const payloadSize
                = this.edgeCompat || typeof TextEncoder === "undefined" ? Buffer.byteLength(payload, "utf8") : new TextEncoder().encode(payload).length;

            // Add payload size plus delimiter (except for last item)
            this.currentBatchSize += payloadSize + (i < this.batchQueue.length - 1 ? this.batchSendDelimiter.length : 0);
        }

        try {
            await this.sendBatch(batch);
        } catch (error) {
            if (this.onError) {
                this.onError(error as Error);
            }
        } finally {
            this.isProcessingBatch = false;

            // If there are more items in the queue, process them
            if (this.batchQueue.length > 0) {
                this.processBatch();
            }
        }
    }

    /**
     * Sends a batch of payloads to the HTTP endpoint.
     */
    protected async sendBatch(batch: string[]): Promise<void> {
        let batchPayload: string;

        switch (this.batchMode) {
            case "array": {
                // Send batch entries as a plain JSON array
                const batchEntries = batch.map((payload) => JSON.parse(payload));

                batchPayload = JSON.stringify(batchEntries);
                break;
            }

            case "field": {
                // Parse each payload as JSON and create a batch object
                const fieldEntries = batch.map((payload) => JSON.parse(payload));
                const batchObject = this.batchFieldName ? { [this.batchFieldName]: fieldEntries } : {};

                batchPayload = JSON.stringify(batchObject);
                break;
            }

            default: {
                // Use delimiter-based batching (default behavior)
                batchPayload = batch.join(this.batchSendDelimiter);
                break;
            }
        }

        await this.sendPayload(batchPayload, this.batchContentType);
    }

    /**
     * Sends a single payload to the HTTP endpoint.
     */
    protected async sendPayload(payload: string, contentType?: string): Promise<void> {
        // Get headers
        const headers: Record<string, string> = typeof this.headers === "function" ? this.headers() : { ...this.headers };

        // Set content type - user headers take precedence
        if (!headers["content-type"]) {
            headers["content-type"] = contentType ?? this.contentType;
        }

        let finalPayload: string | Uint8Array = payload;

        // Apply compression if enabled and not in Edge compatibility mode
        if (this.compression && !this.edgeCompat) {
            try {
                finalPayload = await compressData(payload);
                headers["content-encoding"] = "gzip";
            } catch (error) {
                // If compression fails, fall back to uncompressed
                if (this.onError) {
                    this.onError(new Error(`Compression failed: ${error}`));
                }
            }
        }

        await sendWithRetry(
            this.url,
            this.method,
            headers,
            finalPayload,
            this.maxRetries,
            this.retryDelay,
            this.respectRateLimit,
            this.onDebugRequestResponse as
                | ((requestResponse: {
                    req: { body: string | Uint8Array; headers: Record<string, string>; method: string; url: string };
                    res: { body: string; headers: Record<string, string>; status: number; statusText: string };
                }) => void)
                | undefined,
            this.onError,
        );
    }
}
