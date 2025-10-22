import type { Options as RfsOptions } from "rotating-file-stream";

import type { AbstractJsonReporterOptions } from "../json/abstract-json-reporter";
import { AbstractJsonReporter } from "../json/abstract-json-reporter";
import RotatingFileStream from "./utils/rotating-file-stream";

/**
 * Options for configuring the JsonFileReporter.
 */
export type FileReporterOptions = AbstractJsonReporterOptions
    & RfsOptions & {
        /** Path to the log file */
        filePath: string;
        /** Whether to write immediately to disk instead of buffering */
        writeImmediately?: boolean;
    };

/**
 * JSON File Reporter.
 *
 * A reporter that writes structured JSON log entries to rotating files on disk.
 * Supports automatic file rotation based on size, time intervals, and compression.
 * @template L - The log level type
 * @example
 * ```typescript
 * const reporter = new JsonFileReporter({
 *   filePath: "/var/log/app.log",
 *   interval: "1d", // Rotate daily
 *   size: "10M",   // Rotate when file reaches 10MB
 *   compress: "gzip"
 * });
 *
 * logger.registerReporters([reporter]);
 * ```
 */
export class JsonFileReporter<L extends string = string> extends AbstractJsonReporter<L> {
    /** The rotating file stream instance */
    protected stream: RotatingFileStream;

    /**
     * Creates a new JsonFileReporter instance.
     * @param options Configuration options for file rotation and JSON formatting
     */
    public constructor(options: FileReporterOptions) {
        super();

        const { filePath, writeImmediately = false, ...rfsOptions } = options;

        this.stream = new RotatingFileStream(filePath, writeImmediately, {
            compress: "gzip", // compress rotated files
            interval: "1d", // rotate daily
            size: "10M", // rotate every 10 MegaBytes written,
            ...rfsOptions,
        });
    }

    /**
     * Writes a JSON message to the rotating file stream.
     * @param message The JSON-formatted log message to write
     * @protected
     */
    // eslint-disable-next-line no-underscore-dangle
    protected override _log(message: string): void {
        this.stream.write(`${message}\n`);
    }
}
