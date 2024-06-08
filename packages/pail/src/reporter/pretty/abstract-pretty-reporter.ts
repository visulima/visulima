import type { stringify } from "safe-stable-stringify";

import { LOG_TYPES } from "../../constants";
import type { DefaultLogTypes, LiteralUnion, LoggerTypesAwareReporter, LoggerTypesConfig, ReadonlyMeta, StringifyAwareReporter } from "../../types";

abstract class AbstractPrettyReporter<T extends string = never, L extends string = never> implements LoggerTypesAwareReporter<T, L>, StringifyAwareReporter<L> {
    protected readonly _styles: PrettyStyleOptions;

    protected _loggerTypes: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    protected _stringify: typeof stringify | undefined;

    protected constructor(options: Partial<PrettyStyleOptions>) {
        this._styles = {
            bold: {
                label: false,
            },
            dateFormatter: (date: Date) => [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":"),
            underline: {
                label: false,
                message: false,
                prefix: false,
                suffix: false,
            },
            uppercase: {
                label: false,
            },
            ...options,
        } as PrettyStyleOptions;

        this._loggerTypes = LOG_TYPES as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        this._stringify = function_;
    }

    public setLoggerTypes(types: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>): void {
        this._loggerTypes = types;
    }

    public abstract log(meta: ReadonlyMeta<L>): void;
}

export type PrettyStyleOptions = {
    bold: {
        label: boolean;
    };
    dateFormatter: (date: Date) => string;
    // Length of the message before a line break is inserted
    messageLength: number | undefined;
    underline: {
        label: boolean;
        prefix: boolean;
        suffix: boolean;
    };
    uppercase: {
        label: boolean;
    };
};

export default AbstractPrettyReporter;
