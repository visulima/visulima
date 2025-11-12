import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Norwegian aliases to standard keys
const noUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "y",
    år: "y",
    d: "d",
    dag: "d",
    dager: "d",
    m: "mo",
    måned: "mo",
    måneder: "mo",
    millisekund: "ms",
    millisekunder: "ms",
    min: "m",
    minutt: "m",
    minutter: "m",
    mnd: "mo",
    ms: "ms",
    s: "s",
    sek: "s",
    sekund: "s",
    sekunder: "s",
    t: "h",
    time: "h",
    timer: "h",
    u: "w",
    uke: "w",
    uker: "w",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "år",
    (counter) => `måned${counter === 1 ? "" : "er"}`,
    (counter) => `uke${counter === 1 ? "" : "r"}`,
    (counter) => `dag${counter === 1 ? "" : "er"}`,
    (counter) => `time${counter === 1 ? "" : "r"}`,
    (counter) => `minutt${counter === 1 ? "" : "er"}`,
    (counter) => `sekund${counter === 1 ? "" : "er"}`,
    (counter) => `millisekund${counter === 1 ? "" : "er"}`,
    "om %s",
    "%s siden",
    ",",
    noUnitMap,
    " ",
    "_",
);
