import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Icelandic aliases to standard keys
const isUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ár: "y",
    árið: "y",
    árin: "y",
    d: "d",
    dagar: "d",
    dagur: "d",
    klst: "h",
    klukkutímar: "h",
    klukkutími: "h",
    mán: "mo",
    mánuðir: "mo",
    mánuður: "mo",
    millisekúnda: "ms",
    millisekúndur: "ms",
    mín: "m",
    mínúta: "m",
    mínútur: "m",
    ms: "ms",
    s: "s",
    sek: "s",
    sekúnda: "s",
    sekúndur: "s",
    tímar: "h",
    tími: "h",
    v: "w",
    vika: "w",
    vikur: "w",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "ár",
    (counter) => `mánuð${counter === 1 ? "ur" : "ir"}`,
    (counter) => `vik${counter === 1 ? "a" : "ur"}`,
    (counter) => `dag${counter === 1 ? "ur" : "ar"}`,
    (counter) => `klukkutím${counter === 1 ? "i" : "ar"}`,
    (counter) => `mínút${counter === 1 ? "a" : "ur"}`,
    (counter) => `sekúnd${counter === 1 ? "a" : "ur"}`,
    (counter) => `millisekúnd${counter === 1 ? "a" : "ur"}`,
    "eftir %s",
    "fyrir %s síðan",
    ",", // decimal separator
    isUnitMap,
    ".", // group separator
    "_", // placeholder separator
);
