import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Swahili aliases to standard keys
const swUnitMap: Record<string, keyof DurationUnitMeasures> = {
    dakika: "m",
    dk: "m",
    juma: "w", // another word for week
    majuma: "w",
    masaa: "h",
    miaka: "y",
    miezi: "mo",
    milisekunde: "ms",
    ms: "ms",
    mwaka: "y",
    mwe: "mo",
    mwezi: "mo",
    // Abbreviations (less common but possible)
    mwk: "y",
    sa: "h",
    saa: "h",
    sek: "s",
    sekunde: "s",
    siku: "d",
    sk: "d",
    wiki: "w",
    wk: "w",
} as const;

export const durationLanguage: DurationLanguage = {
    _numberFirst: true,
    ...createDurationLanguage(
        (counter) => (counter === 1 ? "mwaka" : "miaka"),
        (counter) => (counter === 1 ? "mwezi" : "miezi"),
        "wiki",
        (counter) => (counter === 1 ? "siku" : "masiku"),
        (counter) => (counter === 1 ? "saa" : "masaa"),
        "dakika",
        "sekunde",
        "milisekunde",
        "%s baadaye",
        "tokea %s",
        ".", // decimal separator
        swUnitMap,
        ",", // group separator
        "_", // placeholder separator
    ),
};
