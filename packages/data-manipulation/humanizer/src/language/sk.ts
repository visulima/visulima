import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";
import getCzechOrSlovakForm from "./util/duration/get-czech-or-slovak-form";

// Map Slovak aliases to standard keys
const skUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    deň: "d",
    dni: "d",
    dní: "d",
    h: "h",
    hod: "h",
    hodín: "h",
    hodina: "h",
    hodiny: "h",
    m: "mo",
    mes: "mo",
    mesiac: "mo",
    mesiace: "mo",
    mesiacov: "mo",
    milisekúnd: "ms",
    milisekunda: "ms",
    milisekundy: "ms",
    min: "m",
    minút: "m",
    minúta: "m",
    minúty: "m",
    ms: "ms",
    r: "y",
    rok: "y",
    rokov: "y",
    roky: "y",
    s: "s",
    sek: "s",
    sekúnd: "s",
    sekunda: "s",
    sekundy: "s",
    t: "w",
    týž: "w",
    týždeň: "w",
    týždne: "w",
    týždňov: "w",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => ["rok", "roky", "roky", "rokov"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["mesiac", "mesiace", "mesiace", "mesiacov"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["týždeň", "týždne", "týždne", "týždňov"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["deň", "dni", "dni", "dní"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["hodina", "hodiny", "hodiny", "hodín"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["minúta", "minúty", "minúty", "minút"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["sekunda", "sekundy", "sekundy", "sekúnd"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["milisekunda", "milisekundy", "milisekundy", "milisekúnd"][getCzechOrSlovakForm(counter)] as string,
    "za %s", // "in %s"
    "pred %s", // "%s ago"
    ",", // decimal separator in Slovak
    skUnitMap,
    " ", // group separator in Slovak
    "_", // placeholder separator
);
