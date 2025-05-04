import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Sorani Kurdish aliases to standard keys
const ckbUnitMap: Record<string, keyof DurationUnitMeasures> = {
    خولەک: "m",
    ساڵ: "y",
    مانگ: "mo",
    هەفتە: "w",
    چرکە: "s",
    ڕۆژ: "d",
    کاتژمێر: "h",
    ミリچركة: "ms",
};

export const durationLanguage = createDurationLanguage(
    "ساڵ",
    "مانگ",
    "هەفتە",
    "ڕۆژ",
    "کاژێر",
    "خولەک",
    "چرکە",
    "میلی چرکە",
    "لە s%",
    "پێش s%",
    "٫", // decimal - Arabic uses U+066B
    ckbUnitMap,
    "٬", // groupSeparator - Arabic uses U+066C
    "_", // placeholderSeparator
);
