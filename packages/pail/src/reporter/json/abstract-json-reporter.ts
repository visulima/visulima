import type { stringify } from "safe-stable-stringify";

import type { Meta, Rfc5424LogLevels, StringifyAwareReporter } from "../../types";

abstract class AbstractJsonReporter<L extends string = never> implements StringifyAwareReporter<L> {
    protected _stringify: typeof stringify | undefined;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this._stringify = function_;
    }

    public log(meta: Meta<L>): void {
        const { type, ...rest } = meta;

        if (rest.label) {
            rest.label = rest.label.trim();
        }

        if (rest.file) {
            rest.file = `${rest.file.name}:${rest.file.line}${rest.file.column ? `:${rest.file.column}` : ""}`;
        }

        if (rest.scope?.length === 0) {
            delete rest.scope;
        }

        this._log(
            (this._stringify as typeof stringify)(rest) as string,
            type.level,
        );
    }

    protected abstract _log(message: string, logLevel: L | Rfc5424LogLevels): void;
}

export default AbstractJsonReporter;
