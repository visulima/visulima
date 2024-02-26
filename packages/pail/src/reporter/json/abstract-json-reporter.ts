import type { stringify } from "safe-stable-stringify";
import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels, ReadonlyMeta, StringifyAwareReporter } from "../../types";

export abstract class AbstractJsonReporter<L extends string = never> implements StringifyAwareReporter<L> {
    protected _stringify: typeof stringify | undefined;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        this._stringify = function_;
    }

    public log(meta: ReadonlyMeta<L>): void {
        const { file, type, ...rest } = meta;

        if (rest.label) {
            rest.label = rest.label.trim();
        }

        if (file) {
            // This is a hack to make the file property a string
            (rest as unknown as Omit<ReadonlyMeta<L>, "file"> & { file: string }).file = file.name + ":" + file.line + (file.column ? ":" + file.column : "");
        }

        if (rest.scope?.length === 0) {
            delete rest.scope;
        }

        this._log((this._stringify as typeof stringify)(rest) as string, type.level);
    }

    protected abstract _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void;
}
