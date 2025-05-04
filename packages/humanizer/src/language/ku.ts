import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Kurdish (Kurmanji) aliases to standard keys
const kuUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "h", // Abbreviation for demjimêr
    demjimêr: "h", // More formal for hour
    deqe: "m",
    deqîqe: "m", // Alternative spelling
    dq: "m",
    h: "w",
    hefte: "w",
    m: "mo",
    meh: "mo",
    ms: "ms",
    mîlîsanî: "ms", // millisecond
    r: "d",
    roj: "d",
    s: "y",
    saet: "h",
    sal: "y",
    san: "s", // Abbreviation
    saniye: "s",
    seet: "h", // Sometimes 'saet' or 'seat' is used
    ç: "s", // Abbreviation for çirk
    çirk: "s", // Another word for second
} as const;

export const durationLanguage = createDurationLanguage(
    "sal",
    "meh",
    "hefte",
    "roj",
    "seet",
    "deqe",
    "saniye",
    "mîlîçirk",
    "له‌ %s",
    "%s",
    ",", // decimal separator
    kuUnitMap,
    ".", // group separator
    "_", // placeholder separator
);

// Note: Kurdish pluralization is complex and context-dependent, not handled here.
