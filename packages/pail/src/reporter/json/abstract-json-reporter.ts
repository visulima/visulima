import { serializeError } from "@visulima/error/error";
import type { stringify } from "safe-stable-stringify";
import type { LiteralUnion } from "type-fest";

import { EMPTY_SYMBOL } from "../../constants";
import type { ExtendedRfc5424LogLevels, ReadonlyMeta, StringifyAwareReporter } from "../../types";

export type AbstractJsonReporterOptions = {
    error: Partial<{
        exclude?: string[];
        maxDepth?: number;
        useToJSON?: boolean;
    }>;
};

export abstract class AbstractJsonReporter<L extends string = string> implements StringifyAwareReporter<L> {
    protected stringify: typeof stringify | undefined;

    protected errorOptions: AbstractJsonReporterOptions["error"];

    public constructor(options: Partial<AbstractJsonReporterOptions> = {}) {
        this.errorOptions = options.error ?? {};
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        this.stringify = function_;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public log(meta: ReadonlyMeta<L>): void {
        // @ts-ignore -- tsup can find the type
        const { context, error, file, message, type, ...rest } = meta;

        if (rest.label) {
            rest.label = rest.label.trim();
        }

        if (file) {
            // This is a hack to make the file property a string
            (rest as unknown as Omit<ReadonlyMeta<L>, "file"> & { file: string }).file = `${file.name}:${file.line}${file.column ? `:${file.column}` : ""}`;
        }

        if (message === EMPTY_SYMBOL) {
            (rest as unknown as Omit<ReadonlyMeta<L>, "message"> & { message: string | undefined }).message = undefined;
        } else {
            (rest as unknown as Omit<ReadonlyMeta<L>, "message"> & { message: ReadonlyMeta<L>["message"] }).message = message;
        }

        if (error) {
            (rest as unknown as Omit<ReadonlyMeta<L>, "error"> & { error: ReadonlyMeta<L>["error"] }).error = serializeError(error, this.errorOptions);
        }

        if (context) {
            const newContext: ReadonlyMeta<L>["context"] = [];

            for (const item of context) {
                if (item === EMPTY_SYMBOL) {
                    continue;
                }

                if (item instanceof Error) {
                    newContext.push(serializeError(item, this.errorOptions));
                } else {
                    newContext.push(item);
                }
            }

            (rest as unknown as Omit<ReadonlyMeta<L>, "context"> & { context: ReadonlyMeta<L>["context"] }).context = newContext;
        }

        this._log((this.stringify as typeof stringify)(rest) as string, type.level);
    }

    protected abstract _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void;
}
