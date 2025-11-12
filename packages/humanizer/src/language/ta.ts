import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Tamil aliases to standard keys
const taUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ms: "ms",
    ஆ: "y",
    ஆண்டு: "y",
    ஆண்டுகள்: "y",
    நா: "d",
    நாட்கள்: "d",
    நாள்: "d",
    நி: "m",
    நிமிடங்கள்: "m",
    நிமிடம்: "m",
    நொடி: "s", // common alternative
    நொடிகள்: "s",
    ம: "h",
    மணி: "h",
    மணிகள்: "h",
    மணிநேரம்: "h", // common alternative
    மா: "mo",
    மாதங்கள்: "mo",
    மாதம்: "mo",
    மில்லிநொடி: "ms",
    மில்லிவினாடி: "ms",
    மிவி: "ms",
    வா: "w",
    வாரங்கள்: "w",
    வாரம்: "w",
    வி: "s",
    வினாடி: "s",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "வருடம்" : "ஆண்டுகள்"),
    (counter) => (counter === 1 ? "மாதம்" : "மாதங்கள்"),
    (counter) => (counter === 1 ? "வாரம்" : "வாரங்கள்"),
    (counter) => (counter === 1 ? "நாள்" : "நாட்கள்"),
    (counter) => (counter === 1 ? "மணி" : "மணிநேரம்"),
    (counter) => `நிமிட${counter === 1 ? "ம்" : "ங்கள்"}`,
    (counter) => `வினாடி${counter === 1 ? "" : "கள்"}`,
    (counter) => `மில்லி விநாடி${counter === 1 ? "" : "கள்"}`,
    "%s இல்",
    "%s முன்பு",
    ".", // decimal separator
    taUnitMap,
    ",", // group separator
    "_", // placeholder separator
);
