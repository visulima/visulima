import type { DefaultLogTypes, LiteralUnion, LoggerTypesConfig } from "../types";

export const getLongestBadge = <L extends string, T extends string>(types: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>): string => {
    const badges = Object.keys(types).map((x) => types[x as T].badge ?? "");

    if (badges.length === 0) {
        return "";
    }

    // eslint-disable-next-line unicorn/no-array-reduce
    return badges.reduce((x, y) => (x.length > y.length ? x : y));
};
