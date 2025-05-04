import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map German aliases to standard keys
const deUnitMap: Record<string, keyof DurationUnitMeasures> = {
    j: "y",
    jahr: "y",
    jahre: "y",
    millisekunde: "ms",
    millisekunden: "ms",
    min: "m",
    minute: "m",
    minuten: "m",
    mon: "mo",
    monat: "mo",
    monate: "mo",
    ms: "ms",
    s: "s",
    sek: "s",
    sekunde: "s",
    sekunden: "s",
    std: "h",
    stunde: "h",
    stunden: "h",
    t: "d",
    tag: "d",
    tage: "d",
    wo: "w",
    woche: "w",
    wochen: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => `Jahr${counter === 1 ? "" : "e"}`,
    (counter) => `Monat${counter === 1 ? "" : "e"}`,
    (counter) => `Woche${counter === 1 ? "" : "n"}`,
    (counter) => `Tag${counter === 1 ? "" : "e"}`,
    (counter) => `Stunde${counter === 1 ? "" : "n"}`,
    (counter) => `Minute${counter === 1 ? "" : "n"}`,
    (counter) => `Sekunde${counter === 1 ? "" : "n"}`,
    (counter) => `Millisekunde${counter === 1 ? "" : "n"}`,
    "in %s",
    "vor %s",
    ",",
    deUnitMap,
    ".",
    "_",
);
