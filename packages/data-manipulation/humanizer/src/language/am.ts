import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Amharic aliases to standard keys
const amUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ሚሊሰከንድ: "ms",
    ሰከንድ: "s",
    ሰዓት: "h",
    ሳምንት: "w",
    ቀን: "d",
    ወር: "mo",
    ዓመት: "y",
    ደቂቃ: "m",
};

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "ዓመት",
    "ወር",
    "ሳምንት",
    "ቀን",
    "ሰዓት",
    "ደቂቃ",
    "ሰከንድ",
    "ሚሊሰከንድ",
    "በአንድ %s",
    "%s በፊት",
    ".", // decimal
    amUnitMap,
    ",", // groupSeparator
    "_", // placeholderSeparator
);
