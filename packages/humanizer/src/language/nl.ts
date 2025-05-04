import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Dutch aliases to standard keys
const nlUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    dag: "d",
    dagen: "d",
    j: "y",
    jaar: "y",
    jaren: "y",
    maand: "mo",
    maanden: "mo",
    milliseconde: "ms",
    milliseconden: "ms",
    min: "m",
    minuten: "m",
    minuut: "m",
    mnd: "mo",
    ms: "ms",
    s: "s",
    sec: "s",
    seconde: "s",
    seconden: "s",
    u: "h",
    uren: "h",
    uur: "h",
    w: "w",
    week: "w",
    weken: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    "jaar",
    (counter) => (counter === 1 ? "maand" : "maanden"),
    (counter) => (counter === 1 ? "week" : "weken"),
    (counter) => (counter === 1 ? "dag" : "dagen"),
    "uur",
    (counter) => (counter === 1 ? "minuut" : "minuten"),
    (counter) => (counter === 1 ? "seconde" : "seconden"),
    (counter) => (counter === 1 ? "milliseconde" : "milliseconden"),
    "over %s",
    "%s geleden",
    ",", // decimal
    nlUnitMap,
    ".", // groupSeparator
    "_", // placeholderSeparator
);
