import type { Writable } from "node:stream";

import type { Options as RfsOptions } from "rotating-file-stream";
import { createStream as createRfsStream } from "rotating-file-stream";

import { SafeStreamHandler } from "./safe-stream-handler";

/**
 * A wrapper for the `rfs` module that will optionally write to disk immediately
 * by creating and closing a new stream on each write.
 */
export class RotatingFileStream {
    private readonly _filePath: string;

    private readonly _immediate: boolean;

    private readonly _stream: Writable | undefined;

    private readonly _options: RfsOptions;

    public constructor(filePath: string, writeImmediately = false, options: RfsOptions = {}) {
        this._filePath = filePath;
        this._immediate = writeImmediately;
        this._options = options;

        if (!this._immediate) {
            this._stream = createRfsStream(this._filePath, options);
        }
    }

    /**
     * Writes `message` to the instance's internal _stream
     * @param message Message to write
     */
    public write(message: string): void {
        let fileStream = this._stream;

        if (this._immediate) {
            fileStream = createRfsStream(this._filePath, this._options);
        }

        const stream = new SafeStreamHandler(fileStream as Writable, this._filePath);

        stream.write(message);

        if (this._immediate) {
            stream.end();
        }
    }

    /**
     * Ends the instance's internal _stream
     *
     * When `immediate` is not `true`, a call to `write` after calling this method
     * will throw an error.
     */
    public end(): void {
        if (this._stream !== undefined) {
            this._stream.end();
        }
    }
}
