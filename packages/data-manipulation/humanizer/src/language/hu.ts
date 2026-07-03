import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Hungarian aliases to standard keys
const huUnitMap: Record<string, keyof DurationUnitMeasures> = {
    e: "y",
    év: "y",
    éve: "y",
    évek: "y",
    ezredmásodperc: "ms",
    ezredmásodpercek: "ms",
    h: "mo",
    het: "w",
    hét: "w",
    hetek: "w",
    hó: "mo",
    hónap: "mo",
    hónapok: "mo",
    másodperc: "s",
    másodpercek: "s",
    mp: "s",
    ms: "ms",
    n: "d",
    nap: "d",
    napok: "d",
    ó: "h",
    óra: "h",
    órák: "h",
    p: "m",
    perc: "m",
    percek: "m",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "év",
    "hónap",
    "hét",
    "nap",
    "óra",
    "perc",
    "másodperc",
    "ezredmásodperc",
    "%s múlva",
    "%s",
    ",", // decimal separator in Hungarian
    huUnitMap,
    " ", // group separator in Hungarian
    "_", // placeholder separator
);
