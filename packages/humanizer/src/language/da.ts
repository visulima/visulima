import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Danish aliases to standard keys
const daUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    dag: "d",
    dage: "d",
    md: "mo",
    millisekund: "ms",
    millisekunder: "ms",
    min: "m",
    minut: "m",
    minutter: "m",
    ms: "ms",
    måned: "mo",
    måneder: "mo",
    s: "s",
    sek: "s",
    sekund: "s",
    sekunder: "s",
    t: "h",
    time: "h",
    timer: "h",
    u: "w",
    uge: "w",
    uger: "w",
    år: "y",
} as const;

export const durationLanguage = createDurationLanguage(
    "år",
    (counter) => `måned${counter === 1 ? "" : "er"}`,
    (counter) => `uge${counter === 1 ? "" : "r"}`,
    (counter) => `dag${counter === 1 ? "" : "e"}`,
    (counter) => `time${counter === 1 ? "" : "r"}`,
    (counter) => `minut${counter === 1 ? "" : "ter"}`,
    (counter) => `sekund${counter === 1 ? "" : "er"}`,
    (counter) => `millisekund${counter === 1 ? "" : "er"}`,
    "om %s",
    "%s siden",
    ",",
    daUnitMap,
    ".",
    "_",
);
