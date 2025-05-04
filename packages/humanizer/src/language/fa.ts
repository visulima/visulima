import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Persian aliases to standard keys
const faUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ثانیه: "s",
    ثانیه‌ها: "s",
    دقایق: "m",
    دقیقه: "m",
    روز: "d",
    روزها: "d",
    ساعت: "h",
    سال: "y",
    سالها: "y",
    ماه: "mo",
    میلی‌ثانیه: "ms",
    میلی‌ثانیه‌ها: "ms",
    هفته: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    "سال",
    "ماه",
    "هفته",
    "روز",
    "ساعت",
    "دقیقه",
    "ثانیه",
    "میلی‌ثانیه",
    "%s بعد",
    "%s قبل",
    "٫", // decimal - Arabic decimal separator
    faUnitMap,
    "٬", // groupSeparator - Arabic thousands separator
    "_", // placeholderSeparator
);
