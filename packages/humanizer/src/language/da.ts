import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Danish aliases to standard keys
const daUnitMap: Record<string, keyof DurationUnitMeasures> = {
    år: "y",
    d: "d",
    dag: "d",
    dage: "d",
    måned: "mo",
    måneder: "mo",
    md: "mo",
    millisekund: "ms",
    millisekunder: "ms",
    min: "m",
    minut: "m",
    minutter: "m",
    ms: "ms",
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
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
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
