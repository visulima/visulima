import type { Options as RfsOptions } from "rotating-file-stream";

import AbstractFileReporter from "../json/abstract-json-reporter";
import RotatingFileStream from "./utils/rotating-file-stream";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type FileReporterOptions = RfsOptions & {
    filePath: string;
    writeImmediately?: boolean;
};

export class JsonFileReporter<L extends string = string> extends AbstractFileReporter<L> {
    protected stream: RotatingFileStream;

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

    protected override _log(message: string): void {
        this.stream.write(message + "\n");
    }
}
