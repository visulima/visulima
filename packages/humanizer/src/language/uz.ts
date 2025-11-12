import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Uzbek aliases to standard keys
const uzUnitMap: Record<string, keyof DurationUnitMeasures> = {
    h: "w",
    hafta: "w",
    k: "d",
    kun: "d",
    m: "m",
    millisekund: "ms",
    min: "m",
    minut: "m",
    ms: "ms",
    o: "mo",
    oy: "mo",
    s: "h",
    sek: "s",
    sekund: "s",
    soat: "h",
    y: "y",
    yil: "y",
} as const;

// Uzbek uses the same form for singular and plural
export const durationLanguage: DurationLanguage = createDurationLanguage(
    "yil",
    "oy",
    "hafta",
    "kun",
    "soat",
    "minut",
    "sekund",
    "millisekund",
    "%s da",
    "%s avval", // "%s ago"
    ",", // decimal separator in Uzbek
    uzUnitMap,
    " ", // group separator in Uzbek
    "_", // placeholder separator
);
