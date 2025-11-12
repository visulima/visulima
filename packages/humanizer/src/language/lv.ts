import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

const getLatvianForm = (counter: number) => counter % 10 === 1 && counter % 100 !== 11;

// Map Latvian aliases to standard keys
const lvUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    diena: "d",
    dienas: "d",
    g: "y",
    gadi: "y",
    gads: "y",
    m: "mo",
    mēn: "mo",
    mēneši: "mo",
    mēnesis: "mo",
    milisekunde: "ms",
    milisekundes: "ms",
    min: "m",
    minūte: "m",
    minūtes: "m",
    ms: "ms",
    n: "w",
    ned: "w",
    nedēļa: "w",
    nedēļas: "w",
    s: "s",
    sek: "s",
    sekunde: "s",
    sekundes: "s",
    st: "h",
    stunda: "h",
    stundas: "h",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => (getLatvianForm(counter) ? "gads" : "gadi"),
    (counter) => (getLatvianForm(counter) ? "mēnesis" : "mēneši"),
    (counter) => (getLatvianForm(counter) ? "nedēļa" : "nedēļas"),
    (counter) => (getLatvianForm(counter) ? "diena" : "dienas"),
    (counter) => (getLatvianForm(counter) ? "stunda" : "stundas"),
    (counter) => (getLatvianForm(counter) ? "minūte" : "minūtes"),
    (counter) => (getLatvianForm(counter) ? "sekunde" : "sekundes"),
    (counter) => (getLatvianForm(counter) ? "milisekunde" : "milisekundes"),
    "pēc %s", // "in %s"
    "pirms %s", // "%s ago"
    ",", // decimal separator in Latvian
    lvUnitMap,
    " ", // group separator in Latvian
    "_", // placeholder separator
);
