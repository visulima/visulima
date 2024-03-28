import createDurationLanguage from "./util/create-duration-language";
import getCzechOrSlovakForm from "./util/duration/get-czech-or-slovak-form";

export const durationLanguage = createDurationLanguage(
    (c) => ["rok", "roky", "roky", "rokov"][getCzechOrSlovakForm(c)],
    (c) => ["mesiac", "mesiace", "mesiace", "mesiacov"][getCzechOrSlovakForm(c)],
    (c) => ["týždeň", "týždne", "týždne", "týždňov"][getCzechOrSlovakForm(c)],
    (c) => ["deň", "dni", "dni", "dní"][getCzechOrSlovakForm(c)],
    (c) => ["hodina", "hodiny", "hodiny", "hodín"][getCzechOrSlovakForm(c)],
    (c) => ["minúta", "minúty", "minúty", "minút"][getCzechOrSlovakForm(c)],
    (c) => ["sekunda", "sekundy", "sekundy", "sekúnd"][getCzechOrSlovakForm(c)],
    (c) => ["milisekunda", "milisekundy", "milisekundy", "milisekúnd"][getCzechOrSlovakForm(c)],
    "za %s",
    "pred %s",
    ",",
);
