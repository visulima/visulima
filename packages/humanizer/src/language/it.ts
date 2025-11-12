import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Italian aliases to standard keys
const itUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "y",
    anni: "y",
    anno: "y",
    g: "d",
    giorni: "d",
    giorno: "d",
    h: "h",
    // 'm.' can mean month or minute in Italian; use 'mes' for month
    mes: "mo",
    mese: "mo",
    mesi: "mo",
    millisecondi: "ms",
    millisecondo: "ms",
    min: "m",
    minuti: "m",
    minuto: "m",
    ms: "ms",
    ora: "h",
    ore: "h",
    s: "s",
    sec: "s",
    secondi: "s",
    secondo: "s",
    sett: "w",
    settimana: "w",
    settimane: "w",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "anno" : "anni"),
    (counter) => (counter === 1 ? "mese" : "mesi"),
    (counter) => (counter === 1 ? "settimana" : "settimane"),
    (counter) => (counter === 1 ? "giorno" : "giorni"),
    (counter) => (counter === 1 ? "ora" : "ore"),
    (counter) => (counter === 1 ? "minuto" : "minuti"),
    (counter) => (counter === 1 ? "secondo" : "secondi"),
    (counter) => (counter === 1 ? "millisecondo" : "millisecondi"),
    "tra %s",
    "%s fa",
    ",", // decimal
    itUnitMap,
    ".", // groupSeparator
    "_", // placeholderSeparator
);
