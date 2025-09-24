import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";
import getCzechOrSlovakForm from "./util/duration/get-czech-or-slovak-form";

// Map Czech aliases to standard keys
const csUnitMap: Record<string, keyof DurationUnitMeasures> = {
    den: "d",
    dne: "d",
    dní: "d",
    dny: "d",
    hodin: "h",
    hodina: "h",
    hodiny: "h",
    let: "y",
    měsíc: "mo",
    měsíce: "mo",
    měsíců: "mo",
    milisekund: "ms",
    milisekunda: "ms",
    milisekundy: "ms",
    minut: "m",
    minuta: "m",
    minuty: "m",
    rok: "y",
    roku: "y",
    roky: "y",
    sekund: "s",
    sekunda: "s",
    sekundy: "s",
    týden: "w",
    týdne: "w",
    týdnů: "w",
    týdny: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => ["rok", "roku", "roky", "let"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["měsíc", "měsíce", "měsíce", "měsíců"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["týden", "týdne", "týdny", "týdnů"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["den", "dne", "dny", "dní"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["hodina", "hodiny", "hodiny", "hodin"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["minuta", "minuty", "minuty", "minut"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["sekunda", "sekundy", "sekundy", "sekund"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["milisekunda", "milisekundy", "milisekundy", "milisekund"][getCzechOrSlovakForm(counter)] as string,
    "za %s",
    "před %s",
    ",", // decimal
    csUnitMap,
    " ", // groupSeparator (space in Czech)
    "_", // placeholderSeparator
);
