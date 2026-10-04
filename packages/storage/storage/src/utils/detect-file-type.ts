import type { Readable } from "node:stream";
import { PassThrough, pipeline, Transform } from "node:stream";

import type { FileTypeResult } from "file-type";
import { fileTypeFromBuffer } from "file-type";

/**
 * Detects the file type from a buffer using magic numbers (binary signatures).
 * This provides more accurate file type detection than relying on file extensions or Content-Type headers.
 * @param buffer The buffer to detect file type from
 * @returns The detected file type with extension and MIME type, or undefined if detection fails
 */
export const detectFileTypeFromBuffer = async (buffer: Buffer | Uint8Array): Promise<{ ext: string; mime: string } | undefined> => {
    try {
        return await fileTypeFromBuffer(buffer);
    } catch {
        return undefined;
    }
};

/**
 * Detects file type from a Node.js stream by peeking at the first chunk and returns both the detected type and a new stream.
 * This peeks at the stream data without consuming it, allowing the original stream to be used normally.
 * @param stream The readable stream to detect file type from
 * @param options Optional configuration for file type detection
 * @param options.sampleSize The sample size in bytes to peek (default: 4100)
 * @returns An object with the detected file type and a new readable stream
 */
export const detectFileTypeFromStream = async (
    stream: Readable,
    options?: { sampleSize?: number },
): Promise<{ fileType?: { ext: string; mime: string }; stream: Readable }> => {
    const sampleSize = options?.sampleSize ?? 4100;
    let fileType: { ext: string; mime: string } | undefined;
    const chunks: Buffer[] = [];
    let totalLength = 0;
    let detectionStarted = false;
    let detectionPromise: Promise<FileTypeResult | undefined> | undefined;

    // Create output stream that will emit all data
    const outputStream = new PassThrough({ highWaterMark: 0 });

    // Use a Transform stream to peek at data
    const peekStream = new Transform({
        flush(callback) {
            // Stream ended before reaching sampleSize: detect on whatever was accumulated
            if (!detectionStarted && chunks.length > 0) {
                detectionStarted = true;

                detectionPromise = fileTypeFromBuffer(Buffer.concat(chunks))
                    .then((detected) => {
                        fileType = detected;

                        return detected;
                    })
                    .catch(() => undefined);
            }

            callback();
        },
        objectMode: false,
        transform(chunk: Buffer, _encoding, callback) {
            // Collect chunks for detection until we have enough data
            if (!detectionStarted) {
                chunks.push(chunk);
                totalLength += chunk.length;

                // Start detection only once we have accumulated enough data
                if (totalLength >= sampleSize) {
                    detectionStarted = true;
                    const buffer = Buffer.concat(chunks);

                    // Start detection asynchronously
                    detectionPromise = fileTypeFromBuffer(buffer)
                        .then((detected) => {
                            fileType = detected;

                            return detected; // Return value for promise chain
                        })
                        .catch(() => undefined); // Ignore detection errors
                }
            }

            // Pass all chunks through
            callback(undefined, chunk);
        },
    });

    // An 'error' event without a listener crashes the process, and the caller attaches its own
    // only after this function returns, so a source that fails during detection (e.g. a client
    // dropping the connection) took the whole server down (#910). Keep a listener for the stream's
    // lifetime: the caller still sees the error through pipeline()/finished(), for-await and
    // `stream.errored`, which all report an error the stream already failed with.
    outputStream.on("error", () => {
        // Reported to the consumer through the stream's errored state
    });

    // pipeline() forwards a failure of any stage to the others instead of throwing it.
    pipeline(stream, peekStream, outputStream, () => {
        // Errors reach the consumer through outputStream
    });

    // Wait for first chunk to arrive so detection can start
    await Promise.race([
        new Promise<void>((resolve) => {
            if (detectionStarted) {
                resolve();

                return;
            }

            const timeout = setTimeout(resolve, 10);

            peekStream.once("data", () => {
                clearTimeout(timeout);
                resolve();
            });
            peekStream.once("end", () => {
                clearTimeout(timeout);
                resolve();
            });
        }),
        new Promise<void>((resolve) => {
            setTimeout(resolve, 10);
        }),
    ]);

    // Wait for detection to complete (with timeout)
    if (detectionPromise) {
        await Promise.race([
            detectionPromise.then(() => undefined),
            new Promise<void>((resolve) => {
                setTimeout(resolve, 150);
            }),
        ]).catch(() => {
            // Ignore errors
        });
    }

    return { fileType, stream: outputStream };
};
