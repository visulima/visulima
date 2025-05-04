import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Bengali aliases to standard keys
const bnUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ঘন্টা: "h",
    দিন: "d",
    বছর: "y",
    মাস: "mo",
    মিনিট: "m",
    মিলিসেকেন্ড: "ms",
    সপ্তাহ: "w",
    সেকেন্ড: "s",
};

export const durationLanguage = createDurationLanguage(
    "বছর",
    "মাস",
    "সপ্তাহ",
    "দিন",
    "ঘন্টা",
    "মিনিট",
    "সেকেন্ড",
    "মিলিসেকেন্ড",
    "%s পরে",
    "%s আগে",
    ".", // decimal
    bnUnitMap,
    ",", // groupSeparator
    "_", // placeholderSeparator
);
