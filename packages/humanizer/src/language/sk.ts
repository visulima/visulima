import createDurationLanguage from "./util/create-duration-language";
import getCzechOrSlovakForm from "./util/duration/get-czech-or-slovak-form";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return ["rok", "roky", "roky", "rokov"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["mesiac", "mesiace", "mesiace", "mesiacov"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["týždeň", "týždne", "týždne", "týždňov"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["deň", "dni", "dni", "dní"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["hodina", "hodiny", "hodiny", "hodín"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["minúta", "minúty", "minúty", "minút"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["sekunda", "sekundy", "sekundy", "sekúnd"][getCzechOrSlovakForm(c)];
    },
    function (c) {
        return ["milisekunda", "milisekundy", "milisekundy", "milisekúnd"][getCzechOrSlovakForm(c)];
    },
    "za %s",
    "pred %s",
    ",",
);
