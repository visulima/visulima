import createDurationLanguage from "./util/create-duration-language";
import getCzechOrSlovakForm from "./util/duration/get-czech-or-slovak-form";

export const durationLanguage = createDurationLanguage(
    (c) => ["rok", "roku", "roky", "let"][getCzechOrSlovakForm(c)],
    (c) => ["měsíc", "měsíce", "měsíce", "měsíců"][getCzechOrSlovakForm(c)],
    (c) => ["týden", "týdne", "týdny", "týdnů"][getCzechOrSlovakForm(c)],
    (c) => ["den", "dne", "dny", "dní"][getCzechOrSlovakForm(c)],
    (c) => ["hodina", "hodiny", "hodiny", "hodin"][getCzechOrSlovakForm(c)],
    (c) => ["minuta", "minuty", "minuty", "minut"][getCzechOrSlovakForm(c)],
    (c) => ["sekunda", "sekundy", "sekundy", "sekund"][getCzechOrSlovakForm(c)],
    (c) => ["milisekunda", "milisekundy", "milisekundy", "milisekund"][getCzechOrSlovakForm(c)],
    "za %s",
    "před %s",
    ",",
);
