import type { ServerResponse } from "node:http";
import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";

/**
 * Creates a range-limited stream that properly handles backpressure.
 * @param sourceStream Source readable stream to limit
 * @param start Start byte position (inclusive)
 * @param end End byte position (inclusive)
 * @returns New readable stream limited to the specified byte range
 */
export const createRangeLimitedStream = (sourceStream: Readable, start: number, end: number): Readable => {
    let bytesRead = 0;
    let bytesSent = 0;
    const contentLength = end - start + 1;

    return new PassThrough({
        // Use appropriate high water mark for better backpressure handling
        highWaterMark: Math.min(64 * 1024, contentLength), // 64KB or content length, whichever is smaller
        transform(chunk: Buffer, _, callback) {
            const chunkSize = chunk.length;
            const currentPos = bytesRead;
            const endPos = currentPos + chunkSize - 1;

            bytesRead += chunkSize;

            // Check if this chunk contains data we need
            if (endPos < start) {
                // Chunk is entirely before the range we want
                callback();

                return;
            }

            if (currentPos > end) {
                // Chunk is entirely after the range we want
                this.end();
                callback();

                return;
            }

            // Calculate which part of this chunk to send
            const chunkStart = Math.max(0, start - currentPos);
            const chunkEnd = Math.min(chunkSize, end - currentPos + 1);

            if (chunkStart < chunkEnd) {
                const dataToSend = chunk.subarray(chunkStart, chunkEnd);

                bytesSent += dataToSend.length;

                // Push the data and handle backpressure
                const canContinue = this.push(dataToSend);

                if (!canContinue) {
                    // Backpressure: pause the source stream
                    sourceStream.pause();
                }
            }

            // Check if we've sent all the requested data
            if (bytesSent >= contentLength) {
                this.end();
                sourceStream.destroy();
            }

            callback();
        },
    });
};

/**
 * Pipes streams with proper backpressure handling and error management.
 * @param source Source readable stream to pipe from
 * @param destination Destination response stream to pipe to
 * @param sendError Function to send error responses
 */
export const pipeWithBackpressure = (
    source: Readable,
    destination: ServerResponse,
    sendError: (response: ServerResponse, error: Error) => Promise<void>,
): void => {
    let isDestroyed = false;

    const cleanup = () => {
        if (isDestroyed)
            return;

        isDestroyed = true;
        source.destroy();
    };

    // Handle destination backpressure
    destination.on("drain", () => {
        source.resume();
    });

    destination.on("close", cleanup);
    destination.on("finish", cleanup);
    destination.on("error", cleanup);

    // Handle source stream
    source.on("end", () => {
        destination.end();
    });

    source.on("error", async (error) => {
        if (!isDestroyed) {
            await sendError(destination, error);
            cleanup();
        }
    });

    source.on("data", (chunk) => {
        const canContinue = destination.write(chunk);

        if (!canContinue) {
            // Backpressure: pause the source stream
            source.pause();
        }
    });

    // Handle response abortion (client disconnect)
    if (typeof destination.listeners === "function" && destination.listeners("close")?.length === 0) {
        destination.on("close", cleanup);
    }
};

/**
 * Creates a stream response configuration object.
 * @param stream The readable stream
 * @param size Optional total size of the stream
 * @param headers Optional headers to include
 * @returns Stream response configuration
 */
export const createStreamResponse = (
    stream: Readable,
    size?: number,
    headers: Record<string, string | number> = {},
): { headers: Record<string, string | number>; size?: number; stream: Readable } => {
    return {
        headers,
        size,
        stream,
    };
};
