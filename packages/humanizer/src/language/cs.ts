import createDurationLanguage from "./util/create-duration-language";
import getCzechOrSlovakForm from "./util/duration/get-czech-or-slovak-form";

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
    ",",
);
