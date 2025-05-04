import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Hungarian aliases to standard keys
const huUnitMap: Record<string, keyof DurationUnitMeasures> = {
    e: "y",
    ezredmásodperc: "ms",
    ezredmásodpercek: "ms",
    h: "mo",
    het: "w",
    hetek: "w",
    hét: "w",
    hó: "mo",
    hónap: "mo",
    hónapok: "mo",
    mp: "s",
    ms: "ms",
    másodperc: "s",
    másodpercek: "s",
    n: "d",
    nap: "d",
    napok: "d",
    p: "m",
    perc: "m",
    percek: "m",
    év: "y",
    éve: "y",
    évek: "y",
    ó: "h",
    óra: "h",
    órák: "h",
} as const;

export const durationLanguage = createDurationLanguage(
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
