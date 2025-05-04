import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Traditional Chinese aliases to standard keys
const zhTWUnitMap: Record<string, keyof DurationUnitMeasures> = {
    個月: "mo",
    分: "m",
    分鐘: "m",
    天: "d",
    小時: "h",
    年: "y",
    日: "d",
    星期: "w",
    時: "h",
    月: "mo",
    毫秒: "ms",
    秒: "s",
    秒鐘: "s",
    週: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    "年",
    "個月",
    "周",
    "天",
    "小時",
    "分鐘",
    "秒",
    "毫秒",
    "%s後",
    "%s前",
    ".", // decimal
    zhTWUnitMap,
    ",", // groupSeparator
    "_", // placeholderSeparator
);
