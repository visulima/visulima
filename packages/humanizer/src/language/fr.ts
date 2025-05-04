import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map French aliases to standard keys
const frUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "y",
    an: "y",
    année: "y",
    années: "y",
    ans: "y",
    h: "h",
    heure: "h",
    heures: "h",
    j: "d",
    jour: "d",
    jours: "d",
    m: "mo",
    milliseconde: "ms",
    millisecondes: "ms",
    min: "m",
    minute: "m",
    minutes: "m",
    mn: "m",
    mois: "mo",
    ms: "ms",
    s: "s",
    sec: "s",
    seconde: "s",
    secondes: "s",
    sem: "w",
    semaine: "w",
    semaines: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => `an${counter >= 2 ? "s" : ""}`,
    "mois",
    (counter) => `semaine${counter >= 2 ? "s" : ""}`,
    (counter) => `jour${counter >= 2 ? "s" : ""}`,
    (counter) => `heure${counter >= 2 ? "s" : ""}`,
    (counter) => `minute${counter >= 2 ? "s" : ""}`,
    (counter) => `seconde${counter >= 2 ? "s" : ""}`,
    (counter) => `milliseconde${counter >= 2 ? "s" : ""}`,
    "dans %s",
    "il y a %s",
    ",", // decimal
    frUnitMap,
    " ", // groupSeparator (space in French)
    "_", // placeholderSeparator
);
