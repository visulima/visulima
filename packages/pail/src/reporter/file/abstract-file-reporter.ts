import type { Options as RfsOptions } from "rotating-file-stream";

import type { ReadonlyMeta, Reporter } from "../../types";
import RotatingFileStream from "./utils/rotating-file-stream";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type Options = RfsOptions & {
    filePath: string;
    writeImmediately?: boolean;
};

export abstract class AbstractFileReporter<L extends string = never> implements Reporter<L> {
    protected _stream: RotatingFileStream;

    protected constructor(options: Options) {
        const { filePath, writeImmediately = false, ...rfsOptions } = options;

        this._stream = new RotatingFileStream(filePath, writeImmediately, rfsOptions);
    }

    public log(meta: ReadonlyMeta<L>): void {
        this._stream.write(this._formatMessage(meta as ReadonlyMeta<L>) + "\n");
    }

    protected abstract _formatMessage(data: ReadonlyMeta<L>): string;
}
