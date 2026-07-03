import type { LiteralUnion } from "type-fest";

import type { DefaultLoggerTypes, DefaultLogTypes, LoggerTypesConfig } from "../types";

const mergeTypes = <L extends string, T extends string>(
    standard: DefaultLoggerTypes<L>,
    custom: LoggerTypesConfig<T, L>,
): LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L> => {
    const types = { ...standard } as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>;

    Object.keys(custom).forEach((type) => {
        types[type as T] = { ...types[type as T], ...custom[type as T] };
    });

    return types;
};

export default mergeTypes;
