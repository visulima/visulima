import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Korean aliases to standard keys
const koUnitMap: Record<string, keyof DurationUnitMeasures> = {
    개월: "mo",
    날: "d",
    년: "y",
    달: "mo",
    밀리세컨드: "ms",
    밀리초: "ms",
    분: "m",
    분간: "m",
    시: "h",
    시간: "h",
    월: "mo",
    일: "d",
    주: "w",
    주일: "w",
    초: "s",
    초간: "s",
    해: "y",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "년",
    "개월",
    "주일",
    "일",
    "시간",
    "분",
    "초",
    "밀리 초",
    "%s 후",
    "%s 전",
    ".", // decimal
    koUnitMap,
    ",", // groupSeparator
    "_", // placeholderSeparator
);
