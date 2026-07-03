import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Chinese (Simplified) aliases to standard keys
const zhCNUnitMap: Record<string, keyof DurationUnitMeasures> = {
    个月: "mo",
    分: "m",
    分钟: "m",
    周: "w",
    天: "d",
    小时: "h",
    年: "y",
    日: "d",
    时: "h",
    星期: "w",
    月: "mo",
    毫秒: "ms",
    秒: "s",
    秒钟: "s",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "年",
    "个月",
    "周",
    "天",
    "小时",
    "分",
    "秒",
    "毫秒",
    "%s后",
    "%s前",
    ".", // decimal
    zhCNUnitMap,
    ",", // groupSeparator
    "_", // placeholderSeparator
);
