import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Afrikaans aliases to standard keys
const afUnitMap: Record<string, keyof DurationUnitMeasures> = {
    dae: "d",
    dag: "d",
    jaar: "y",
    jare: "y",
    maand: "mo",
    maande: "mo",
    millisekonde: "ms",
    millisekondes: "ms",
    minute: "m",
    minuut: "m",
    sekonde: "s",
    sekondes: "s",
    ure: "h",
    uur: "h",
    week: "w",
    weke: "w",
};

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "jaar",
    (counter) => `maand${counter === 1 ? "" : "e"}`,
    (counter) => (counter === 1 ? "week" : "weke"),
    (counter) => (counter === 1 ? "dag" : "dae"),
    (counter) => (counter === 1 ? "uur" : "ure"),
    (counter) => (counter === 1 ? "minuut" : "minute"),
    (counter) => `sekonde${counter === 1 ? "" : "s"}`,
    (counter) => `millisekonde${counter === 1 ? "" : "s"}`,
    "oor %s",
    "%s gelede",
    ",", // decimal
    afUnitMap,
    " ", // groupSeparator (often space in af)
    "_", // placeholderSeparator
);
