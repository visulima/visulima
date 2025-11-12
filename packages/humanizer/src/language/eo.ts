import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Esperanto aliases to standard keys
const eoUnitMap: Record<string, keyof DurationUnitMeasures> = {
    h: "h",
    horo: "h",
    horoj: "h",
    j: "y",
    jaro: "y",
    jaroj: "y",
    milisekundo: "ms",
    milisekundoj: "ms",
    min: "m",
    minuto: "m",
    minutoj: "m",
    mon: "mo",
    monato: "mo",
    monatoj: "mo",
    ms: "ms",
    s: "s",
    sek: "s",
    sekundo: "s",
    sekundoj: "s",
    sem: "w",
    semajno: "w",
    semajnoj: "w",
    t: "d",
    tago: "d",
    tagoj: "d",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => `jaro${counter === 1 ? "" : "j"}`,
    (counter) => `monato${counter === 1 ? "" : "j"}`,
    (counter) => `semajno${counter === 1 ? "" : "j"}`,
    (counter) => `tago${counter === 1 ? "" : "j"}`,
    (counter) => `horo${counter === 1 ? "" : "j"}`,
    (counter) => `minuto${counter === 1 ? "" : "j"}`,
    (counter) => `sekundo${counter === 1 ? "" : "j"}`,
    (counter) => `milisekundo${counter === 1 ? "" : "j"}`,
    "post %s",
    "antaŭ %s",
    ",",
    eoUnitMap,
    ".",
    "_",
);
