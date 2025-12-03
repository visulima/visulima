import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Vietnamese aliases to standard keys
const viUnitMap: Record<string, keyof DurationUnitMeasures> = {
    giây: "s",
    giờ: "h",
    mili: "ms",
    miligiây: "ms",
    năm: "y",
    ngày: "d",
    phút: "m",
    tháng: "mo",
    tuần: "w",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
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
