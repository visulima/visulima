import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Urdu aliases to standard keys
const urUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ms: "ms",
    ث: "s", // Alternative Abbreviation
    د: "d", // Abbreviation
    دن: "d",
    س: "y", // Abbreviation
    سال: "y",
    سیک: "s", // Abbreviation
    سیکنڈ: "s",
    م: "m", // Abbreviation
    ماہ: "mo", // Alternative word
    مل: "ms", // Abbreviation
    ملی_سیکنڈ: "ms",
    منٹ: "m",
    مہ: "mo", // Abbreviation
    مہینہ: "mo",
    مہینے: "mo",
    گھ: "h", // Abbreviation
    گھنٹہ: "h",
    گھنٹے: "h",
    ہ: "w", // Abbreviation
    ہفتہ: "w",
    ہفتے: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    "سال",
    (counter) => (counter === 1 ? "مہینہ" : "مہینے"),
    (counter) => (counter === 1 ? "ہفتہ" : "ہفتے"),
    "دن",
    (counter) => (counter === 1 ? "گھنٹہ" : "گھنٹے"),
    "منٹ",
    "سیکنڈ",
    "ملی سیکنڈ",
    "%s بعد",
    "%s قبل",
    ".", // decimal separator (Urdu uses .)
    urUnitMap,
    ",", // group separator (Urdu uses ,)
    "_", // placeholder separator
);
