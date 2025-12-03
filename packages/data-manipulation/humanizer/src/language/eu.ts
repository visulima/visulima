import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Basque aliases to standard keys
const euUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "w",
    aste: "w",
    e: "d",
    egun: "d",
    h: "mo",
    hilabete: "mo",
    m: "m",
    milisegundo: "ms",
    minutu: "m",
    ms: "ms",
    o: "h",
    ordu: "h",
    s: "s",
    segundo: "s",
    u: "y",
    urte: "y",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "urte",
    "hilabete",
    "aste",
    "egun",
    "ordu",
    "minutu",
    "segundo",
    "milisegundo",
    "%s barru",
    "duela %s",
    ",", // decimal separator
    euUnitMap,
    ".", // group separator (Basque often uses . for grouping)
    "_", // placeholder separator
);
