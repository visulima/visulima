import createDurationLanguage from "./util/create-duration-language";
import getCzechOrSlovakForm from "./util/duration/get-czech-or-slovak-form";

export const durationLanguage = createDurationLanguage(
    (counter) => ["rok", "roky", "roky", "rokov"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["mesiac", "mesiace", "mesiace", "mesiacov"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["týždeň", "týždne", "týždne", "týždňov"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["deň", "dni", "dni", "dní"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["hodina", "hodiny", "hodiny", "hodín"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["minúta", "minúty", "minúty", "minút"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["sekunda", "sekundy", "sekundy", "sekúnd"][getCzechOrSlovakForm(counter)] as string,
    (counter) => ["milisekunda", "milisekundy", "milisekundy", "milisekúnd"][getCzechOrSlovakForm(counter)] as string,
    "za %s",
    "pred %s",
    ",",
);
