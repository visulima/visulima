import type { Readable } from "node:stream";
import { PassThrough, Transform } from "node:stream";

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

    try {
        const detectionChunks: Buffer[] = [];
        let totalLength = 0;
        let detectionStarted = false;
        let detectionPromise: Promise<void> | undefined;
        let streamEnded = false;

        // Create output stream that will emit all data
        // Use highWaterMark: 0 to prevent buffering and ensure data flows through
        const outputStream = new PassThrough({ highWaterMark: 0 });

        // Use a Transform stream to peek at data
        const peekStream = new Transform({
            flush(callback) {
                streamEnded = true;

                // If stream ended before detection started, try with what we have
                if (!detectionStarted && detectionChunks.length > 0) {
                    detectionStarted = true;
                    const buffer = Buffer.concat(detectionChunks);

                    detectionPromise = fileTypeFromBuffer(buffer)
                        .then((detected) => {
                            fileType = detected;
                        })
                        .catch(() => {
                            // Ignore detection errors
                        });
                }

                // End output stream when peek stream ends
                // Don't end immediately - let it end naturally when consumed
                // The stream will end when all data is consumed
                callback();
            },
            objectMode: false,
            transform(chunk: Buffer, encoding, callback) {
                if (!detectionStarted) {
                    detectionChunks.push(chunk);
                    totalLength += chunk.length;

                    // Start detection when we have enough data or first chunk
                    if (totalLength >= sampleSize || totalLength > 0) {
                        detectionStarted = true;
                        const buffer = Buffer.concat(detectionChunks);

                        // Start detection (async)
                        detectionPromise = fileTypeFromBuffer(buffer)
                            .then((detected) => {
                                fileType = detected;

                                return detected; // Return value so promise resolves
                            })
                            .catch(() =>
                                // Ignore detection errors
                                undefined, // Return undefined on error
                            );
                    }
                }

                // Pass chunk through - it will be piped to outputStream
                callback(null, chunk);
            },
        });

        // Pipe original stream through peek stream, then peek stream to output stream
        stream.pipe(peekStream);
        peekStream.pipe(outputStream);

        stream.on("error", (error) => {
            peekStream.destroy(error);
            outputStream.destroy(error);
        });

        peekStream.on("error", (error) => {
            if (!outputStream.destroyed) {
                outputStream.destroy(error);
            }
        });

        // Wait for first chunk to arrive so detection can start
        await Promise.race([
            new Promise<void>((resolve) => {
                if (detectionStarted) {
                    resolve();

                    return;
                }

                const timeout = setTimeout(() => resolve(), 10);

                peekStream.once("data", () => {
                    clearTimeout(timeout);
                    resolve();
                });
                peekStream.once("end", () => {
                    clearTimeout(timeout);
                    resolve();
                });
            }),
            new Promise<void>((resolve) => setTimeout(() => resolve(), 10)),
        ]);

        // Wait for detection to complete (with timeout)
        if (detectionPromise) {
            await Promise.race([detectionPromise, new Promise<void>((resolve) => setTimeout(() => resolve(), 150))]).catch(() => {
                // Ignore errors
            });
        }

        return { fileType, stream: outputStream };
    } catch {
        // If detection fails, just return the original stream
        return { fileType: undefined, stream };
    }
};
