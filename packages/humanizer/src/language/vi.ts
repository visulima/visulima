import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Vietnamese aliases to standard keys
const viUnitMap: Record<string, keyof DurationUnitMeasures> = {
    giây: "s",
    giờ: "h",
    mili: "ms",
    miligiây: "ms",
    ngày: "d",
    năm: "y",
    phút: "m",
    tháng: "mo",
    tuần: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    "năm",
    "tháng",
    "tuần",
    "ngày",
    "giờ",
    "phút",
    "giây",
    "mili giây",
    "%s tới",
    "%s trước",
    ",", // decimal
    viUnitMap,
    ".", // groupSeparator
    "_", // placeholderSeparator
);
