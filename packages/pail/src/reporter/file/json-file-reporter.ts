import type { stringify } from "safe-stable-stringify";

import type { Meta } from "../../types";
import type { Options as FileReporterOptions } from "./abstract-file-reporter";
import { AbstractFileReporter } from "./abstract-file-reporter";

export class JsonFileReporter<L extends string = never> extends AbstractFileReporter<L> {
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    #stringify: typeof stringify | undefined;

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
        this.#stringify = function_;
    }

    protected _formatMessage(meta: Meta<L>): string {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment,@typescript-eslint/prefer-ts-expect-error
        // @ts-ignore - @TODO: check rollup-plugin-dts
        const { file, type, ...rest } = meta;

        if (rest.label) {
            rest.label = rest.label.trim();
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-nocheck - @TODO: check rollup-plugin-dts
        if (file) {
            // This is a hack to make the file property a string
            (rest as unknown as Omit<Meta<L>, "file"> & { file: string }).file =
                file.name + ":" + file.line + (file.column ? ":" + file.column : "");
        }

        return (this.#stringify as typeof stringify)(rest) as string;
    }
}
