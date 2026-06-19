import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Norwegian Nynorsk aliases to standard keys
const nnUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "y",
    år: "y",
    d: "d",
    dag: "d",
    dagar: "d",
    m: "mo",
    månad: "mo",
    månader: "mo",
    millisekund: "ms",
    min: "m",
    minutt: "m",
    mnd: "mo",
    ms: "ms",
    s: "s",
    sek: "s",
    sekund: "s",
    t: "h",
    timar: "h",
    time: "h",
    u: "w",
    veke: "w",
    veker: "w",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "år",
    (counter) => `månad${counter === 1 ? "" : "er"}`,
    (counter) => `veke${counter === 1 ? "" : "r"}`,
    (counter) => `dag${counter === 1 ? "" : "ar"}`,
    (counter) => `tim${counter === 1 ? "e" : "ar"}`,
    "minutt",
    "sekund",
    "millisekund",
    "om %s",
    "%s sidan",
    ",",
    nnUnitMap,
    " ",
    "_",
);
