import type { stringify } from "safe-stable-stringify";
import type { LiteralUnion } from "type-fest";

import { EMPTY_SYMBOL } from "../../constants";
import type { ExtendedRfc5424LogLevels, ReadonlyMeta, StringifyAwareReporter } from "../../types";

abstract class AbstractJsonReporter<L extends string = string> implements StringifyAwareReporter<L> {
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    protected stringify: typeof stringify | undefined;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        this.stringify = function_;
    }

    public log(meta: ReadonlyMeta<L>): void {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment,@typescript-eslint/prefer-ts-expect-error
        // @ts-ignore -- tsup can find the type
        const { file, message, type, ...rest } = meta;

        if (rest.label) {
            rest.label = rest.label.trim();
        }

        if (file) {
            // This is a hack to make the file property a string
            (rest as unknown as Omit<ReadonlyMeta<L>, "file"> & { file: string }).file = file.name + ":" + file.line + (file.column ? ":" + file.column : "");
        }

        if (message === EMPTY_SYMBOL) {
            (rest as unknown as Omit<ReadonlyMeta<L>, "message"> & { message: string | undefined }).message = undefined;
        } else {
            (rest as unknown as Omit<ReadonlyMeta<L>, "message"> & { message: ReadonlyMeta<L>["message"] }).message = message;
        }

        this._log((this.stringify as typeof stringify)(rest) as string, type.level);
    }

    protected abstract _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void;
}

export default AbstractJsonReporter;
