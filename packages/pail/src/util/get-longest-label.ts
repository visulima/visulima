import type { LiteralUnion } from "type-fest";

import type { DefaultLogTypes, LoggerTypesConfig } from "../types";

export const getLongestLabel = <L extends string, T extends string>(types: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>): string => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const labels = Object.keys(types).map((x) => types[x as T].label ?? "");

    if (labels.length === 0) {
        return "";
    }

    // eslint-disable-next-line unicorn/no-array-reduce
    return labels.reduce((x, y) => (x.length > y.length ? x : y));
};
