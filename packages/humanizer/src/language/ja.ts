import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Japanese aliases to standard keys
const jaUnitMap: Record<string, keyof DurationUnitMeasures> = {
    か月: "mo",
    ヶ月: "mo",
    じかん: "h",
    しゅう: "w",
    つき: "mo",
    にち: "d",
    ねん: "y",
    びょう: "s",
    ふん: "m",
    ミリびょう: "ms",
    ミリ秒: "ms",
    分: "m",
    分間: "m",
    年: "y",
    日: "d",
    時: "h",
    時間: "h",
    月: "mo",
    秒: "s",
    秒間: "s",
    週: "w",
    週間: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    "年",
    "ヶ月",
    "週間",
    "日",
    "時間",
    "分",
    "秒",
    "ミリ秒",
    "%s後",
    "%s前",
    ".", // decimal
    jaUnitMap,
    ",", // groupSeparator
    "_", // placeholderSeparator
);
