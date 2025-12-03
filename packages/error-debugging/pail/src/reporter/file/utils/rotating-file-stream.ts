import type { Writable } from "node:stream";

import type { createStream as createRotatingStream, Options as RfsOptions } from "rotating-file-stream";

import SafeStreamHandler from "../../../utils/stream/safe-stream-handler";

/**
 * Rotating File Stream.
 *
 * A wrapper for the `rotating-file-stream` module that provides optional immediate
 * writing to disk by creating and closing a new stream on each write operation.
 * This is useful for ensuring log messages are written immediately rather than buffered.
 * @example
 * ```typescript
 * // Buffered writing (default)
 * const bufferedStream = new RotatingFileStream("/var/log/app.log", false, {
 *   interval: "1d",
 *   size: "10M"
 * });
 *
 * // Immediate writing
 * const immediateStream = new RotatingFileStream("/var/log/app.log", true, {
 *   interval: "1d"
 * });
 * ```
 */
class RotatingFileStream {
    readonly #filePath: string;

    readonly #immediate: boolean;

    readonly #stream: Writable | undefined;

    readonly #options: RfsOptions;

    readonly #createRfsStream: typeof createRotatingStream | undefined;

    /**
     * Creates a new RotatingFileStream instance.
     * @param filePath Path to the log file
     * @param writeImmediately Whether to write immediately or buffer writes
     * @param options Options for the rotating file stream
     * @throws {Error} If the 'rotating-file-stream' package is not installed
     */
    public constructor(filePath: string, writeImmediately = false, options: RfsOptions = {}) {
        this.#filePath = filePath;
        this.#immediate = writeImmediately;
        this.#options = options;

        if (!this.#immediate) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require
                this.#createRfsStream = require("rotating-file-stream").createStream;
            } catch {
                throw new Error("The 'rotating-file-stream' package is missing. Make sure to install the 'rotating-file-stream' package.");
            }

            this.#stream = (this.#createRfsStream as typeof createRotatingStream)(this.#filePath, options);
        }
    }

    /**
     * Writes a message to the rotating file stream.
     *
     * If writeImmediately was set to true in the constructor, a new stream
     * is created for each write operation. Otherwise, uses the buffered stream.
     * @param message The message to write to the file
     */
    public write(message: string): void {
        let fileStream = this.#stream;

        if (this.#immediate) {
            fileStream = (this.#createRfsStream as typeof createRotatingStream)(this.#filePath, this.#options);
        }

        const stream = new SafeStreamHandler(fileStream as Writable, this.#filePath);

        stream.write(message);

        if (this.#immediate) {
            stream.end();
        }
    }

    /**
     * Ends the rotating file stream.
     *
     * Closes the underlying stream. When `writeImmediately` is not `true`,
     * calling `write` after calling this method will throw an error.
     */
    public end(): void {
        if (this.#stream !== undefined) {
            this.#stream.end();
        }
    }
}

export default RotatingFileStream;
