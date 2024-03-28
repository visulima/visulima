import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return "ano" + (c === 1 ? "" : "s");
    },
    function (c) {
        return c === 1 ? "mês" : "meses";
    },
    function (c) {
        return "semana" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "dia" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "hora" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "minuto" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "segundo" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "milissegundo" + (c === 1 ? "" : "s");
    },
    "em %s",
    "há %s",
    ",",
);
