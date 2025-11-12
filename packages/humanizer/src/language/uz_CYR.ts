import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Uzbek Cyrillic aliases to standard keys
const uzCyrUnitMap: Record<string, keyof DurationUnitMeasures> = {
    й: "y",
    йил: "y",
    к: "d",
    кун: "d",
    м: "m",
    миллисекунд: "ms",
    мин: "m",
    минут: "m",
    мс: "ms",
    о: "mo",
    ой: "mo",
    с: "h",
    сек: "s",
    секунд: "s",
    соат: "h",
    ҳ: "w",
    ҳафта: "w",
} as const;

// Uzbek Cyrillic uses the same form for singular and plural
export const durationLanguage: DurationLanguage = createDurationLanguage(
    "йил",
    "ой",
    "ҳафта",
    "кун",
    "соат",
    "минут",
    "секунд",
    "миллисекунд",
    "%s да",
    "%s аввал", // "%s ago"
    ",", // decimal separator in Uzbek Cyrillic
    uzCyrUnitMap,
    " ", // group separator in Uzbek Cyrillic
    "_", // placeholder separator
);
