import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

const getLithuanianForm = (counter: number): number => {
    // Numbers ending in 1 (except 11) take the singular form — this includes
    // 1, 21, 101, 201, … Aligns with CLDR Lithuanian rules and the `lv` helper.
    if (counter % 10 === 1 && counter % 100 !== 11) {
        return 0;
    }

    if (Math.floor(counter) !== counter || (counter % 10 >= 2 && counter % 100 > 20) || (counter % 10 >= 2 && counter % 100 < 10)) {
        return 1;
    }

    return 2;
};

// Map Lithuanian aliases to standard keys
const ltUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    diena: "d",
    dienos: "d",
    dienų: "d",
    m: "y",
    mėn: "mo",
    mėnesiai: "mo",
    mėnesių: "mo",
    mėnuo: "mo",
    metai: "y",
    metų: "y",
    milisekundė: "ms",
    milisekundės: "ms",
    milisekundžių: "ms",
    min: "m",
    minučių: "m",
    minutė: "m",
    minutės: "m",
    ms: "ms",
    s: "s",
    sav: "w",
    savaičių: "w",
    savaitė: "w",
    savaitės: "w",
    sek: "s",
    sekundė: "s",
    sekundės: "s",
    sekundžių: "s",
    v: "h",
    val: "h",
    valanda: "h",
    valandos: "h",
    valandų: "h",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => (counter % 10 === 0 || (counter % 100 >= 10 && counter % 100 <= 20) ? "metų" : "metai"),
    (counter) => ["mėnuo", "mėnesiai", "mėnesių"][getLithuanianForm(counter)] as string,
    (counter) => ["savaitė", "savaitės", "savaičių"][getLithuanianForm(counter)] as string,
    (counter) => ["diena", "dienos", "dienų"][getLithuanianForm(counter)] as string,
    (counter) => ["valanda", "valandos", "valandų"][getLithuanianForm(counter)] as string,
    (counter) => ["minutė", "minutės", "minučių"][getLithuanianForm(counter)] as string,
    (counter) => ["sekundė", "sekundės", "sekundžių"][getLithuanianForm(counter)] as string,
    (counter) => ["milisekundė", "milisekundės", "milisekundžių"][getLithuanianForm(counter)] as string,
    "po %s", // "in %s"
    "prieš %s", // "%s ago"
    ",", // decimal separator in Lithuanian
    ltUnitMap,
    " ", // group separator in Lithuanian
    "_", // placeholder separator
);
