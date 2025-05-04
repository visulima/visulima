import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Faroese aliases to standard keys
const foUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    dagar: "d",
    dagur: "d",
    millisekund: "ms",
    min: "m",
    minuttir: "m",
    minuttur: "m",
    mnð: "mo",
    ms: "ms",
    mánaðir: "mo",
    mánaður: "mo",
    s: "s",
    sek: "s",
    sekund: "s",
    t: "h",
    tímar: "h",
    tími: "h",
    v: "w",
    vika: "w",
    vikur: "w",
    ár: "y",
    árini: "y",
    árið: "y",
} as const;

export const durationLanguage = createDurationLanguage(
    "ár",
    (counter) => (counter === 1 ? "mánaður" : "mánaðir"),
    (counter) => (counter === 1 ? "vika" : "vikur"),
    (counter) => (counter === 1 ? "dagur" : "dagar"),
    (counter) => (counter === 1 ? "tími" : "tímar"),
    (counter) => (counter === 1 ? "minuttur" : "minuttir"),
    "sekund",
    "millisekund",
    "um %s",
    "%s síðani",
    ",", // decimal separator
    foUnitMap,
    ".", // group separator
    "_", // placeholder separator
);
