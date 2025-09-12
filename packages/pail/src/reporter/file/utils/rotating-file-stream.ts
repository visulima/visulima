import type { Writable } from "node:stream";

import type { createStream as createRotatingStream, Options as RfsOptions } from "rotating-file-stream";

import SafeStreamHandler from "../../../utils/stream/safe-stream-handler";

/**
 * A wrapper for the `rfs` module that will optionally write to disk immediately
 * by creating and closing a new stream on each write.
 */
class RotatingFileStream {
    readonly #filePath: string;

    readonly #immediate: boolean;

    readonly #stream: Writable | undefined;

    readonly #options: RfsOptions;

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    readonly #createRfsStream: typeof createRotatingStream | undefined;

    public constructor(filePath: string, writeImmediately = false, options: RfsOptions = {}) {
        this.#filePath = filePath;
        this.#immediate = writeImmediately;
        this.#options = options;

        if (!this.#immediate) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require,unicorn/prefer-module
                this.#createRfsStream = require("rotating-file-stream").createStream;
            } catch {
                throw new Error("The 'rotating-file-stream' package is missing. Make sure to install the 'rotating-file-stream' package.");
            }

            this.#stream = (this.#createRfsStream as typeof createRotatingStream)(this.#filePath, options);
        }
    }

    /**
     * Writes `message` to the instance's internal #stream
     * @param message Message to write
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
     * Ends the instance's internal #stream
     *
     * When `immediate` is not `true`, a call to `write` after calling this method
     * will throw an error.
     */
    public end(): void {
        if (this.#stream !== undefined) {
            this.#stream.end();
        }
    }
}

export default RotatingFileStream;
