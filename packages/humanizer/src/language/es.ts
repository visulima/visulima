import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return "año" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "mes" + (c === 1 ? "" : "es");
    },
    function (c) {
        return "semana" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "día" + (c === 1 ? "" : "s");
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
        return "milisegundo" + (c === 1 ? "" : "s");
    },
    "en %s",
    "hace %s",
    ",",
);
