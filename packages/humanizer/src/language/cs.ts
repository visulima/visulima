import createDurationLanguage from "./util/create-duration-language";
import getCzechOrSlovakForm from "./util/duration/get-czech-or-slovak-form";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return ["rok", "roku", "roky", "let"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["měsíc", "měsíce", "měsíce", "měsíců"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["týden", "týdne", "týdny", "týdnů"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["den", "dne", "dny", "dní"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["hodina", "hodiny", "hodiny", "hodin"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["minuta", "minuty", "minuty", "minut"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["sekunda", "sekundy", "sekundy", "sekund"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["milisekunda", "milisekundy", "milisekundy", "milisekund"][getCzechOrSlovakForm(c)];
    },
    "za %s",
    "před %s",
    ",",
);
