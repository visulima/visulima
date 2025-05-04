import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Slovenian aliases to standard keys
const slUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    dan: "d",
    dni: "d",
    l: "y",
    let: "y",
    leta: "y",
    leti: "y",
    leto: "y",
    m: "mo",
    mesec: "mo",
    meseca: "mo",
    mesece: "mo",
    mesecev: "mo",
    milisekund: "ms",
    milisekunda: "ms",
    milisekunde: "ms",
    milisekundi: "ms",
    min: "m",
    minut: "m",
    minuta: "m",
    minute: "m",
    minuti: "m",
    ms: "ms",
    s: "s",
    sek: "s",
    sekund: "ms",
    sekunda: "s",
    sekunde: "s",
    sekundi: "s",
    t: "w",
    teden: "w",
    tedna: "w",
    tedne: "w",
    tednov: "w",
    u: "h",
    ur: "h",
    ura: "h",
    ure: "h",
    uri: "h",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => {
        if (counter % 10 === 1) {
            return "leto";
        }

        if (counter % 100 === 2) {
            return "leti";
        }

        if (counter % 100 === 3 || counter % 100 === 4 || (Math.floor(counter) !== counter && counter % 100 <= 5)) {
            return "leta";
        }

        return "let";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "mesec";
        }

        if (counter % 100 === 2 || (Math.floor(counter) !== counter && counter % 100 <= 5)) {
            return "meseca";
        }

        if (counter % 10 === 3 || counter % 10 === 4) {
            return "mesece";
        }

        return "mesecev";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "teden";
        }

        if (counter % 10 === 2 || (Math.floor(counter) !== counter && counter % 100 <= 4)) {
            return "tedna";
        }

        if (counter % 10 === 3 || counter % 10 === 4) {
            return "tedne";
        }

        return "tednov";
    },
    (counter) => (counter % 100 === 1 ? "dan" : "dni"),
    (counter) => {
        if (counter % 10 === 1) {
            return "ura";
        }

        if (counter % 100 === 2) {
            return "uri";
        }

        if (counter % 10 === 3 || counter % 10 === 4 || Math.floor(counter) !== counter) {
            return "ure";
        }

        return "ur";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "minuta";
        }

        if (counter % 10 === 2) {
            return "minuti";
        }

        if (counter % 10 === 3 || counter % 10 === 4 || (Math.floor(counter) !== counter && counter % 100 <= 4)) {
            return "minute";
        }

        return "minut";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "sekunda";
        }

        if (counter % 100 === 2) {
            return "sekundi";
        }

        if (counter % 100 === 3 || counter % 100 === 4 || Math.floor(counter) !== counter) {
            return "sekunde";
        }

        return "sekund";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "milisekunda";
        }

        if (counter % 100 === 2) {
            return "milisekundi";
        }

        if (counter % 100 === 3 || counter % 100 === 4 || Math.floor(counter) !== counter) {
            return "milisekunde";
        }

        return "milisekund";
    },
    "čez %s",
    "pred %s",
    ",",
    slUnitMap,
    ".",
    "_",
);
