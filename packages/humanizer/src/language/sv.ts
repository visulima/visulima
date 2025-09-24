import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Swedish aliases to standard keys
const svUnitMap: Record<string, keyof DurationUnitMeasures> = {
    å: "y",
    år: "y",
    d: "d",
    dag: "d",
    dagar: "d",
    mån: "mo",
    månad: "mo",
    månader: "mo",
    millisekund: "ms",
    millisekunder: "ms",
    min: "m",
    minut: "m",
    minuter: "m",
    ms: "ms",
    s: "s",
    sek: "s",
    sekund: "s",
    sekunder: "s",
    t: "h",
    timmar: "h",
    timme: "h",
    v: "w",
    vecka: "w",
    veckor: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    "år",
    (counter) => `månad${counter === 1 ? "" : "er"}`,
    (counter) => `veck${counter === 1 ? "a" : "or"}`,
    (counter) => `dag${counter === 1 ? "" : "ar"}`,
    (counter) => `timm${counter === 1 ? "e" : "ar"}`,
    (counter) => `minut${counter === 1 ? "" : "er"}`,
    (counter) => `sekund${counter === 1 ? "" : "er"}`,
    (counter) => `millisekund${counter === 1 ? "" : "er"}`,
    "om %s",
    "för %s sedan",
    ",", // decimal separator
    svUnitMap,
    " ", // group separator (space is standard)
    "_", // placeholder separator
);
