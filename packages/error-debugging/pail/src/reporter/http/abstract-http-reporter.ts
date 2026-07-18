import { Buffer } from "node:buffer";

import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels, StringifyAwareReporter } from "../../types";
import type { AbstractJsonReporterOptions } from "../json/abstract-json-reporter";
import { AbstractJsonReporter } from "../json/abstract-json-reporter";
import compressData from "./utils/compression";
import LogSizeError from "./utils/log-size-error";
import sendWithRetry from "./utils/retry";

/** Reused across all reporter instances so measuring a payload never allocates a new encoder. */
const sharedTextEncoder = typeof TextEncoder === "undefined" ? undefined : new TextEncoder();

/** Measures the UTF-8 byte length of a payload without allocating a fresh encoder per call. */
const byteLengthOf = (payload: string, edgeCompat: boolean): number => {
    if (edgeCompat || sharedTextEncoder === undefined) {
        return Buffer.byteLength(payload, "utf8");
    }

    return sharedTextEncoder.encode(payload).length;
};

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
     * Maximum number of entries to keep queued while the endpoint is unavailable.
     * When the queue exceeds this limit, the oldest entries are dropped (drop-oldest)
     * so a sustained outage cannot grow memory without bound.
     * @default 10000
     */
    maxQueueSize?: number;

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
     * Optional callback invoked when queued log entries are dropped because the queue
     * exceeded `maxQueueSize`. Receives the number of dropped entries.
     */
    onDrop?: (droppedCount: number) => void;

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

    protected onDrop?: (droppedCount: number) => void;

    protected maxQueueSize: number;

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

    /** Per-entry UTF-8 byte sizes, kept in lockstep with `batchQueue`, so the tracked queue size never re-encodes payloads. */
    protected batchSizeQueue: number[] = [];

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
        this.onDrop = config.onDrop;
        this.maxQueueSize = config.maxQueueSize ?? 10_000;
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
     * Flushes all queued log entries to the HTTP endpoint immediately.
     *
     * Returns a promise that resolves once the queue has been drained (or rejects
     * if a batch send fails terminally). Use this before a serverless function or
     * short-lived process exits so the tail of the batch is not lost.
     * @example
     * ```typescript
     * await reporter.flush();
     * ```
     */
    public async flush(): Promise<void> {
        // Cancel any pending timer so we don't double-process.
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = undefined;
        }

        while (this.batchQueue.length > 0 || this.isProcessingBatch) {
            if (this.isProcessingBatch) {
                // Wait for the in-flight batch to settle before continuing.
                // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
                await new Promise((resolve) => setTimeout(resolve, 0));

                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            await this.processBatch();
        }
    }

    /**
     * Flushes any remaining queued entries and clears pending timers.
     *
     * Counterpart to a transport lifecycle `end`/`dispose`. After calling `close()`
     * the reporter can still be used, but any pending batch timeout is cleared.
     * @example
     * ```typescript
     * process.on("beforeExit", () => reporter.close());
     * ```
     */
    public async close(): Promise<void> {
        await this.flush();
    }

    /**
     * Alias for {@link close} to match common transport `dispose` conventions.
     */
    public async dispose(): Promise<void> {
        await this.close();
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

            const payloadTemplate: { data?: Record<string, unknown>; logLevel: string; message: string } = {
                logLevel: logLevelString,
                message: messageString ?? "",
            };

            if (logData.data) {
                payloadTemplate["data"] = logData.data as Record<string, unknown>;
            } else if (logData.context) {
                payloadTemplate["data"] = logData.context as Record<string, unknown>;
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
            const logEntrySize = byteLengthOf(payload, this.edgeCompat);

            if (logEntrySize > this.maxLogSize) {
                const error = new LogSizeError(
                    `Log entry exceeds maximum size of ${String(this.maxLogSize)} bytes. Size: ${String(logEntrySize)} bytes`,
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
                this.sendPayload(payload).catch((error: unknown) => {
                    if (this.onError) {
                        this.onError(error as Error);
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
            // eslint-disable-next-line no-void -- void needed to handle floating promise
            void this.processBatch();
        }

        this.batchQueue.push(payload);
        this.batchSizeQueue.push(logEntrySize);
        this.currentBatchSize += logEntrySize + this.batchSendDelimiter.length;

        // Enforce the queue cap (drop-oldest) so a sustained endpoint outage cannot grow
        // memory without bound while retries back off.
        if (this.batchQueue.length > this.maxQueueSize) {
            const dropCount = this.batchQueue.length - this.maxQueueSize;
            const dropped = this.batchQueue.splice(0, dropCount);

            this.batchSizeQueue.splice(0, dropCount);

            // Recompute the tracked size for the trimmed queue.
            this.currentBatchSize = this.#computeQueueSize();

            if (this.onDrop) {
                this.onDrop(dropped.length);
            }
        }

        // Start batch timeout if not already running
        this.batchTimeout ??= setTimeout(() => {
            // eslint-disable-next-line no-void -- void needed to handle floating promise
            void this.processBatch();
        }, this.batchSendTimeout);

        // Send immediately if batch size is reached
        if (this.batchQueue.length >= this.batchSize) {
            // eslint-disable-next-line no-void -- void needed to handle floating promise
            void this.processBatch();
        }
    }

    /**
     * Computes the tracked uncompressed size (bytes) of the current batch queue,
     * including delimiters between entries.
     */
    #computeQueueSize(): number {
        let size = 0;

        for (let i = 0; i < this.batchSizeQueue.length; i += 1) {
            size += this.batchSizeQueue[i] + (i < this.batchSizeQueue.length - 1 ? this.batchSendDelimiter.length : 0);
        }

        return size;
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

        this.batchSizeQueue.splice(0, this.batchSize);

        // Recalculate batch size for remaining items in queue
        this.currentBatchSize = this.#computeQueueSize();

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
                // eslint-disable-next-line no-void -- void needed to handle floating promise
                void this.processBatch();
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
        headers["content-type"] ??= contentType ?? this.contentType;

        let finalPayload: string | Uint8Array = payload;

        // Apply compression if enabled and not in Edge compatibility mode
        if (this.compression && !this.edgeCompat) {
            try {
                finalPayload = await compressData(payload);
                headers["content-encoding"] = "gzip";
            } catch (error) {
                // If compression fails, fall back to uncompressed
                if (this.onError) {
                    this.onError(new Error(`Compression failed: ${String(error)}`));
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
            this.onDebugRequestResponse,
            this.onError,
        );
    }
}
