import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Kurdish (Kurmanji) aliases to standard keys
const kuUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ç: "s", // Abbreviation for çirk
    çirk: "s", // Another word for second
    d: "h", // Abbreviation for demjimêr
    demjimêr: "h", // More formal for hour
    deqe: "m",
    deqîqe: "m", // Alternative spelling
    dq: "m",
    h: "w",
    hefte: "w",
    m: "mo",
    meh: "mo",
    mîlîsanî: "ms", // millisecond
    ms: "ms",
    r: "d",
    roj: "d",
    s: "y",
    saet: "h",
    sal: "y",
    san: "s", // Abbreviation
    saniye: "s",
    seet: "h", // Sometimes 'saet' or 'seat' is used
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
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
