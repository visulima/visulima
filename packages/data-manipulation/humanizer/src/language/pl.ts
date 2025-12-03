import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

const getPolishForm = (counter: number): number => {
    if (counter === 1) {
        return 0;
    }

    if (Math.floor(counter) !== counter) {
        return 1;
    }

    if (counter % 10 >= 2 && counter % 10 <= 4 && !(counter % 100 > 10 && counter % 100 < 20)) {
        return 2;
    }

    return 3;
};

// Map Polish aliases to standard keys
const plUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    dni: "d",
    dzień: "d",
    g: "h",
    godz: "h",
    godzin: "h",
    godzina: "h",
    godziny: "h",
    lat: "y",
    lata: "y",
    m: "mo",
    mies: "mo",
    miesiąc: "mo",
    miesiące: "mo",
    miesięcy: "mo",
    milisekund: "ms",
    milisekunda: "ms",
    milisekundy: "ms",
    min: "m",
    minut: "m",
    minuta: "m",
    minuty: "m",
    ms: "ms",
    r: "y",
    rok: "y",
    roku: "y",
    s: "s",
    sek: "s",
    sekund: "s",
    sekunda: "s",
    sekundy: "s",
    t: "w",
    tydzień: "w",
    tyg: "w",
    tygodni: "w",
    tygodnie: "w",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => ["rok", "roku", "lata", "lat"][getPolishForm(counter)] as string,
    (counter) => ["miesiąc", "miesiąca", "miesiące", "miesięcy"][getPolishForm(counter)] as string,
    (counter) => ["tydzień", "tygodnia", "tygodnie", "tygodni"][getPolishForm(counter)] as string,
    (counter) => ["dzień", "dnia", "dni", "dni"][getPolishForm(counter)] as string,
    (counter) => ["godzina", "godziny", "godziny", "godzin"][getPolishForm(counter)] as string,
    (counter) => ["minuta", "minuty", "minuty", "minut"][getPolishForm(counter)] as string,
    (counter) => ["sekunda", "sekundy", "sekundy", "sekund"][getPolishForm(counter)] as string,
    (counter) => ["milisekunda", "milisekundy", "milisekundy", "milisekund"][getPolishForm(counter)] as string,
    "za %s",
    "%s temu",
    ",", // decimal
    plUnitMap,
    " ", // groupSeparator (space in Polish)
    "_", // placeholderSeparator
);
