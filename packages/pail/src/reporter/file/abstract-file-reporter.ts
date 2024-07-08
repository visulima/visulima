import type { Options as RfsOptions } from "rotating-file-stream";

import type { ReadonlyMeta, Reporter } from "../../types";
import RotatingFileStream from "./utils/rotating-file-stream";

export type Options = RfsOptions & {
    filePath: string;
    writeImmediately?: boolean;
};

export abstract class AbstractFileReporter<L extends string = string> implements Reporter<L> {
    protected stream: RotatingFileStream;

    protected constructor(options: Options) {
        const { filePath, writeImmediately = false, ...rfsOptions } = options;

        this.stream = new RotatingFileStream(filePath, writeImmediately, rfsOptions);
    }

    public log(meta: ReadonlyMeta<L>): void {
        this.stream.write(this._formatMessage(meta as ReadonlyMeta<L>) + "\n");
    }

    protected abstract _formatMessage(data: ReadonlyMeta<L>): string;
}
