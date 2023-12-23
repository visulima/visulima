import type { stringify } from "safe-stable-stringify";

import type { Meta } from "../../types";
import type { Options as FileReporterOptions } from "./abstract-file-reporter";
import { AbstractFileReporter } from "./abstract-file-reporter";

class JsonFileReporter<L extends string = never> extends AbstractFileReporter<L> {
    private _stringify: typeof stringify | undefined;

    public constructor(options: FileReporterOptions) {
        super({
            compress: "gzip", // compress rotated files
            interval: "1d", // rotate daily
            size: "10M", // rotate every 10 MegaBytes written
            ...options,
        });
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this._stringify = function_;
    }

    protected _formatMessage(meta: Meta<L>): string {
        const { type, ...rest } = meta;

        if (rest.label) {
            rest.label = rest.label.trim();
        }

        return (this._stringify as typeof stringify)(rest) as string;
    }
}

export default JsonFileReporter;
