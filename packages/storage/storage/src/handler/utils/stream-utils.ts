import type { ServerResponse } from "node:http";
import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";

/**
 * Picks the Range header to honour: none when an `If-Range` validator doesn't match the file's
 * strong ETag or its (at least one second old) Last-Modified date, so a resumed download never
 * mixes two versions of a file (RFC 9110 §13.1.5).
 * @param range Range request header
 * @param ifRange If-Range request header
 * @param headers Response headers carrying the file's ETag / Last-Modified
 * @returns The Range header to parse, or `undefined` to send the whole file
 */
export const rangeIfCurrent = (
    range: string | undefined,
    ifRange: string | undefined,
    headers: Record<string, unknown> | undefined,
): string | undefined => {
    if (!range || !ifRange) {
        return range;
    }

    const header = (name: string): string | undefined => {
        const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name);

        return entry === undefined ? undefined : String(entry[1]);
    };
    const validator = ifRange.trim();

    // An entity-tag validator must match strongly.
    if (validator.startsWith("\"") || validator.startsWith("W/")) {
        return !validator.startsWith("W/") && validator === header("etag") ? range : undefined;
    }

    // Anything else is an HTTP-date, a strong validator only when Last-Modified is at least one
    // second before the response is generated: a file changed within that second may change again
    // under the same date.
    const lastModified = header("last-modified");

    return validator === lastModified && Date.parse(lastModified) <= Date.now() - 1000 ? range : undefined;
};

/**
 * Applies an (already parsed) byte range to a file stream.
 * Shared by the Node and Fetch handlers so both send identical 200/206 responses.
 * @param stream Full file stream
 * @param size Total file size in bytes
 * @param range Requested byte range, if any
 * @returns The stream to send, the response headers it needs and whether it is a partial (206) response
 */
export const applyRange = (
    stream: Readable,
    size: number | undefined,
    range: { end: number; start: number } | undefined,
): { headers: Record<string, number | string>; partial: boolean; stream: Readable } => {
    if (range && size) {
        return {
            headers: {
                "Accept-Ranges": "bytes",
                "Content-Length": range.end - range.start + 1,
                "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
            },
            partial: true,
            stream: createRangeLimitedStream(stream, range.start, range.end),
        };
    }

    return {
        headers: { "Accept-Ranges": "bytes", ...(size ? { "Content-Length": size } : {}) },
        partial: false,
        stream,
    };
};

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
    let finished = false;
    const contentLength = end - start + 1;

    // Stop reading once the range is complete. Unpiping first means no write can follow end()
    // (which would fail the response with ERR_STREAM_WRITE_AFTER_END); chunks already buffered are
    // dropped by the `finished` check.
    const finish = (): void => {
        finished = true;
        sourceStream.unpipe(passThrough);
        passThrough.end();
        sourceStream.destroy();
    };

    // Backpressure needs no handling here: the Transform holds back its callback while the readable
    // side is full, and `pipe` pauses and resumes the source accordingly.
    const passThrough: PassThrough = new PassThrough({
        highWaterMark: Math.min(64 * 1024, contentLength), // 64KB or content length, whichever is smaller
        transform(chunk: Buffer, _, callback) {
            if (finished) {
                callback();

                return;
            }

            const chunkSize = chunk.length;
            const currentPos = bytesRead;
            const endPos = currentPos + chunkSize - 1;

            bytesRead += chunkSize;

            // Chunk is entirely before the range we want
            if (endPos < start) {
                callback();

                return;
            }

            // The part of this chunk inside the range (a chunk after the range has none)
            const chunkStart = Math.max(0, start - currentPos);
            const chunkEnd = Math.min(chunkSize, end - currentPos + 1);

            if (chunkStart < chunkEnd) {
                const dataToSend = chunk.subarray(chunkStart, chunkEnd);

                bytesSent += dataToSend.length;
                this.push(dataToSend);
            }

            if (bytesSent >= contentLength || currentPos > end) {
                finish();
            }

            callback();
        },
    });

    // Feed the source into the range-limiting transform. Without this wiring the
    // returned PassThrough is never written to and every 206 response hangs with
    // an empty body. `pipe` handles writable-side backpressure; forward source
    // errors explicitly since `pipe` does not propagate them.
    sourceStream.pipe(passThrough);

    sourceStream.on("error", (error) => {
        passThrough.destroy(error);
    });

    // When the consumer cancels (e.g. the client aborts a 206 download) only the returned stream is
    // destroyed; release the source too so file descriptors and connections are not leaked.
    passThrough.on("close", () => {
        if (!sourceStream.destroyed) {
            sourceStream.destroy();
        }
    });

    return passThrough;
};

/**
 * Pipes streams with proper backpressure handling and error management.
 * @param source Source readable stream to pipe from
 * @param destination Destination response stream to pipe to
 * @param sendError Function to send error responses
 */
export const pipeWithBackpressure = <TResponse extends ServerResponse>(
    source: Readable,
    destination: TResponse,
    sendError: (response: TResponse, error: Error) => Promise<void>,
): void => {
    let isDestroyed = false;

    const cleanup = () => {
        if (isDestroyed) {
            return;
        }

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
        if (isDestroyed) {
            return;
        }

        // Once any body byte has been flushed the status line and headers are
        // already committed; calling sendError would set headers again and throw
        // ERR_HTTP_HEADERS_SENT inside this async listener (an unhandled rejection
        // that can crash the process). In that case abort the response instead.
        if (destination.headersSent || destination.writableEnded) {
            cleanup();
            destination.destroy(error);

            return;
        }

        // The file's headers are set but not sent; left in place they would describe the error body
        // (a Content-Length the client waits for forever, a Content-Range, the file's ETag).
        for (const name of ["Content-Disposition", "Content-Encoding", "Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
            destination.removeHeader(name);
        }

        try {
            await sendError(destination, error);
        } catch {
            // sendError may still race a flush; never let it escape this listener.
            destination.destroy(error);
        } finally {
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
