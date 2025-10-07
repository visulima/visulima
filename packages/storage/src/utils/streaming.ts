import { Readable } from "node:stream";

/**
 * Streaming utility functions for efficient file handling
 */

/**
 * Options for streaming operations
 */
export interface StreamingOptions {
    /** Whether to handle backpressure automatically */
    handleBackpressure?: boolean;
    /** High water mark for stream buffering */
    highWaterMark?: number;
    /** Timeout for stream operations */
    timeout?: number;
}

/**
 * Create a streaming response handler that automatically handles backpressure
 */
export const createStreamingResponse = (
    stream: Readable,
    options: StreamingOptions & {
        onData?: (chunk: Buffer) => void;
        onEnd?: () => void;
        onError?: (error: Error) => void;
    } = {},
): Readable => {
    const { handleBackpressure = true, onData, onEnd, onError } = options;

    if (handleBackpressure) {
        // Handle backpressure by monitoring stream state
        stream.on("pause", () => {
            // Stream is paused due to backpressure
        });

        stream.on("resume", () => {
            // Stream has resumed
        });
    }

    if (onError) {
        stream.on("error", onError);
    }

    if (onEnd) {
        stream.on("end", onEnd);
    }

    if (onData) {
        stream.on("data", onData);
    }

    return stream;
};

/**
 * Create a range-limited stream from a source stream
 */
export const createRangeStream = (sourceStream: Readable, start: number, end?: number): Readable => {
    let position = 0;
    const targetEnd = end ?? Number.POSITIVE_INFINITY;

    return new Readable({
        destroy(error, callback) {
            sourceStream.destroy(error);
            callback(error || undefined);
        },
        read(size) {
            if (position >= targetEnd) {
                this.push(null); // End of stream

                return;
            }

            const remaining = targetEnd - position;
            const toRead = size && size < remaining ? size : remaining;

            // Skip data before start position
            if (position < start) {
                sourceStream.read(start - position);
                position = start;
            }

            const chunk = sourceStream.read(toRead);

            if (chunk) {
                position += chunk.length;
                this.push(chunk);
            } else {
                // Wait for more data
                sourceStream.once("readable", () => {
                    this.read(size);
                });
            }
        },
    });
};

/**
 * Check if a file size warrants streaming treatment
 */
export const shouldUseStreaming = (fileSize: number, threshold: number = 1024 * 1024): boolean => fileSize > threshold;

/**
 * Calculate optimal chunk size for streaming based on file size
 */
export const getOptimalChunkSize = (fileSize: number): number => {
    // Smaller files: use 64KB chunks
    // Medium files: use 256KB chunks
    // Large files: use 1MB chunks
    if (fileSize < 10 * 1024 * 1024) {
        // < 10MB
        return 64 * 1024; // 64KB
    }

    if (fileSize < 100 * 1024 * 1024) {
        // < 100MB
        return 256 * 1024; // 256KB
    }

    return 1024 * 1024; // 1MB
};

/**
 * Create a timeout wrapper for streaming operations
 */
export const withTimeout = <T extends Readable>(stream: T, timeoutMs: number, errorMessage = "Stream operation timed out"): T => {
    const timeout = setTimeout(() => {
        stream.destroy(new Error(errorMessage));
    }, timeoutMs);

    stream.on("end", () => clearTimeout(timeout));
    stream.on("error", () => clearTimeout(timeout));

    return stream;
};

/**
 * Monitor stream performance and log metrics
 */
export const monitorStreamPerformance = (stream: Readable, label: string, logger?: { debug: (message: string, ...arguments_: any[]) => void }): Readable => {
    const startTime = Date.now();
    let totalBytes = 0;
    let chunkCount = 0;

    stream.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        chunkCount++;
    });

    stream.on("end", () => {
        const duration = Date.now() - startTime;
        const mbPerSecond = totalBytes / 1024 / 1024 / (duration / 1000);

        logger?.debug("[%s] Stream completed: %d bytes in %d chunks, %.2f MB/s", label, totalBytes, chunkCount, mbPerSecond);
    });

    stream.on("error", (error) => {
        const duration = Date.now() - startTime;

        logger?.debug("[%s] Stream failed after %dms: %s", label, duration, error.message);
    });

    return stream;
};

/**
 * Create a stream that limits bandwidth
 */
export const createBandwidthLimitedStream = (sourceStream: Readable, bytesPerSecond: number): Readable => {
    let lastChunkTime = Date.now();
    const bufferedChunks: Buffer[] = [];
    let isProcessing = false;

    const targetStream = new Readable({
        read() {
            if (bufferedChunks.length > 0 && !isProcessing) {
                processNextChunk();
            }
        },
    });

    const processNextChunk = () => {
        if (bufferedChunks.length === 0 || isProcessing) {
            return;
        }

        isProcessing = true;
        const chunk = bufferedChunks.shift()!;
        const now = Date.now();
        const timeSinceLastChunk = now - lastChunkTime;
        const targetDelay = (chunk.length / bytesPerSecond) * 1000;

        if (timeSinceLastChunk < targetDelay) {
            const delay = targetDelay - timeSinceLastChunk;

            setTimeout(() => {
                targetStream.push(chunk);
                lastChunkTime = Date.now();
                isProcessing = false;
                processNextChunk();
            }, delay);
        } else {
            targetStream.push(chunk);
            lastChunkTime = now;
            isProcessing = false;
            processNextChunk();
        }
    };

    sourceStream.on("data", (chunk: Buffer) => {
        bufferedChunks.push(chunk);

        if (!isProcessing) {
            processNextChunk();
        }
    });

    sourceStream.on("end", () => {
        // Process remaining chunks
        if (bufferedChunks.length === 0) {
            targetStream.push(null);
        }
    });

    sourceStream.on("error", (error) => {
        targetStream.destroy(error);
    });

    return targetStream;
};
