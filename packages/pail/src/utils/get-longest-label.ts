import type { DefaultLogTypes, LiteralUnion, LoggerTypesConfig } from "../types";

const getLongestLabel = <L extends string, T extends string>(types: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>): string => {
    const labels = Object.keys(types).map((x) => types[x as T].label ?? "");

    if (labels.length === 0) {
        return "";
    }

    // eslint-disable-next-line unicorn/no-array-reduce
    return labels.reduce((x, y) => (x.length > y.length ? x : y));
};

export default getLongestLabel;
