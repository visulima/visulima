import type { Writable } from "node:stream";

import type { Options as RfsOptions } from "rotating-file-stream";
import { createStream as createRfsStream } from "rotating-file-stream";

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

    public constructor(filePath: string, writeImmediately = false, options: RfsOptions = {}) {
        this.#filePath = filePath;
        this.#immediate = writeImmediately;
        this.#options = options;

        if (!this.#immediate) {
            this.#stream = createRfsStream(this.#filePath, options);
        }
    }

    /**
     * Writes `message` to the instance's internal #stream
     * @param message Message to write
     */
    public write(message: string): void {
        let fileStream = this.#stream;

        if (this.#immediate) {
            fileStream = createRfsStream(this.#filePath, this.#options);
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
