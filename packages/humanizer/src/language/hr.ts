import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Croatian aliases to standard keys
const hrUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    dan: "d",
    dana: "d",
    g: "y",
    godina: "y",
    godine: "y",
    godinu: "y",
    h: "h", // Although 'h' is not common in Croatian for hour, it's good for consistency
    milisekunda: "ms",
    milisekunde: "ms",
    milisekundi: "ms",
    min: "m",
    minuta: "m",
    minute: "m",
    minutu: "m",
    mj: "mo",
    mjesec: "mo",
    mjeseca: "mo",
    mjeseci: "mo",
    ms: "ms",
    s: "s",
    sat: "h",
    sata: "h",
    sati: "h",
    sek: "s",
    sekunda: "s",
    sekunde: "s",
    sekundi: "s",
    tj: "w",
    tjedan: "w",
    tjedna: "w",
    tjedni: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => {
        if (counter % 10 === 2 || counter % 10 === 3 || counter % 10 === 4) {
            return "godine";
        }

        return "godina";
    },
    (counter) => {
        if (counter === 1) {
            return "mjesec";
        }

        if (counter === 2 || counter === 3 || counter === 4) {
            return "mjeseca";
        }

        return "mjeseci";
    },
    (counter) => {
        if (counter % 10 === 1 && counter !== 11) {
            return "tjedan";
        }

        return "tjedna";
    },
    (counter) => (counter === 1 ? "dan" : "dana"),
    (counter) => {
        if (counter === 1) {
            return "sat";
        }

        if (counter === 2 || counter === 3 || counter === 4) {
            return "sata";
        }

        return "sati";
    },
    (counter) => {
        const module10 = counter % 10;

        if ((module10 === 2 || module10 === 3 || module10 === 4) && (counter < 10 || counter > 14)) {
            return "minute";
        }

        return "minuta";
    },
    (counter) => {
        const module10 = counter % 10;

        if (module10 === 5 || (Math.floor(counter) === counter && counter >= 10 && counter <= 19)) {
            return "sekundi";
        }

        if (module10 === 1) {
            return "sekunda";
        }

        if (module10 === 2 || module10 === 3 || module10 === 4) {
            return "sekunde";
        }

        return "sekundi";
    },
    (counter) => {
        if (counter === 1) {
            return "milisekunda";
        }

        if (counter % 10 === 2 || counter % 10 === 3 || counter % 10 === 4) {
            return "milisekunde";
        }

        return "milisekundi";
    },
    "za %s",
    "prije %s",
    ",", // decimal separator
    hrUnitMap,
    ".", // group separator
    "_", // placeholder separator
);
