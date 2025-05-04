import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Romanian aliases to standard keys
const roUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "y",
    an: "y",
    ani: "y",
    l: "mo",
    luni: "mo",
    lună: "mo",
    m: "m",
    milisecunde: "ms",
    milisecundă: "ms",
    min: "m",
    minut: "m",
    minute: "m",
    ms: "ms",
    o: "h",
    ore: "h",
    oră: "h",
    s: "s",
    sapt: "w",
    sec: "s",
    secunde: "s",
    secundă: "s",
    săptămâni: "w",
    săptămână: "w",
    z: "d",
    zi: "d",
    zile: "d",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "an" : "ani"),
    (counter) => (counter === 1 ? "lună" : "luni"),
    (counter) => (counter === 1 ? "săptămână" : "săptămâni"),
    (counter) => (counter === 1 ? "zi" : "zile"),
    (counter) => (counter === 1 ? "oră" : "ore"),
    (counter) => (counter === 1 ? "minut" : "minute"),
    (counter) => (counter === 1 ? "secundă" : "secunde"),
    (counter) => (counter === 1 ? "milisecundă" : "milisecunde"),
    "peste %s", // "in %s"
    "%s în urmă", // "%s ago"
    ",", // decimal separator in Romanian
    roUnitMap,
    ".", // group separator in Romanian
    "_", // placeholder separator
);
