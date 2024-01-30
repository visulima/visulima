import type { LiteralUnion } from "type-fest";

import { LOG_TYPES } from "../../constants";
import type { DefaultLogTypes, LoggerTypesAwareReporter, LoggerTypesConfig, ReadonlyMeta, Rfc5424LogLevels } from "../../types";

export abstract class AbstractPrettyReporter<T extends string = never, L extends string = never> implements LoggerTypesAwareReporter<T, L> {
    protected readonly _styles: PrettyStyleOptions;

    protected _loggerTypes: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;

    protected constructor(options: Partial<PrettyStyleOptions>) {
        this._styles = {
            bold: {
                label: false,
            },
            dateFormatter: (date: Date) => date.toISOString(),
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

    public setLoggerTypes(types: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>): void {
        this._loggerTypes = types;
    }

    public log(meta: ReadonlyMeta<L>): void {
        this._log(this._formatMessage(meta as ReadonlyMeta<L>), meta.type.level);
    }

    protected abstract _formatMessage(data: ReadonlyMeta<L>): string;

    protected abstract _log(message: string, logLevel: LiteralUnion<Rfc5424LogLevels, L>): void;

    protected abstract _formatError(error: Error, size: number, groupSpaces: string): string;
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
