import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Romanian aliases to standard keys
const roUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "y",
    an: "y",
    ani: "y",
    l: "mo",
    lună: "mo",
    luni: "mo",
    m: "m",
    milisecundă: "ms",
    milisecunde: "ms",
    min: "m",
    minut: "m",
    minute: "m",
    ms: "ms",
    o: "h",
    oră: "h",
    ore: "h",
    s: "s",
    sapt: "w",
    săptămână: "w",
    săptămâni: "w",
    sec: "s",
    secundă: "s",
    secunde: "s",
    z: "d",
    zi: "d",
    zile: "d",
} as const;

/**
 * Returns a function that selects the appropriate Romanian unit form based on count.
 * Romanian uses "de" before the noun for numbers twenty and above (when not ending in 01-19).
 * @see https://en.wikipedia.org/wiki/Romanian_numbers#Preposition_de
 * @internal
 * @param unit The unit forms [singular, plural, plural with "de"].
 * @returns Function that returns the appropriate form based on counter.
 */
const romanianUnit =
    (unit: [string, string, string]) =>
    (counter: number): string => {
        if (counter === 1) {
            return unit[0];
        }

        if (Math.floor(counter) !== counter || counter === 0) {
            return unit[1];
        }

        const remainder = counter % 100;

        if (remainder >= 1 && remainder <= 19) {
            return unit[1];
        }

        return unit[2];
    };

export const durationLanguage: DurationLanguage = createDurationLanguage(
    romanianUnit(["an", "ani", "de ani"]),
    romanianUnit(["lună", "luni", "de luni"]),
    romanianUnit(["săptămână", "săptămâni", "de săptămâni"]),
    romanianUnit(["zi", "zile", "de zile"]),
    romanianUnit(["oră", "ore", "de ore"]),
    romanianUnit(["minut", "minute", "de minute"]),
    romanianUnit(["secundă", "secunde", "de secunde"]),
    romanianUnit(["milisecundă", "milisecunde", "de milisecunde"]),
    "peste %s", // "in %s"
    "%s în urmă", // "%s ago"
    ",", // decimal separator in Romanian
    roUnitMap,
    ".", // group separator in Romanian
    "_", // placeholder separator
);
