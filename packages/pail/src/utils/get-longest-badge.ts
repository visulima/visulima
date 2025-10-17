import type { LiteralUnion } from "type-fest";

import type { DefaultLogTypes, LoggerTypesConfig } from "../types";

const getLongestBadge = <L extends string, T extends string>(types: LoggerTypesConfig<LiteralUnion<DefaultLogTypes, T>, L>): string => {
    const badges = Object.keys(types).map((x) => types[x as T].badge ?? "");

    if (badges.length === 0) {
        return "";
    }

    // eslint-disable-next-line unicorn/no-array-reduce, @stylistic/no-extra-parens
    return badges.reduce((x, y) => (x.length > y.length ? x : y));
};

export default getLongestBadge;
