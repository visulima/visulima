import type { LiteralUnion } from "type-fest";

import { LOG_TYPES } from "../../constants";
import type { DefaultLogTypes, LoggerTypesAwareReporter, LoggerTypesConfig, ReadonlyMeta } from "../../types";

export const dateFormatter = (date: Date): string => [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");

export abstract class AbstractPrettyReporter<T extends string = string, L extends string = string> implements LoggerTypesAwareReporter<T, L> {
    protected readonly styles: PrettyStyleOptions;

    protected loggerTypes: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;

    protected constructor(options: Partial<PrettyStyleOptions>) {
        this.styles = {
            bold: {
                label: false,
            },
            dateFormatter,
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

        this.loggerTypes = LOG_TYPES as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;
    }

    public setLoggerTypes(types: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>): void {
        this.loggerTypes = types;
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
