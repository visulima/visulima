import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return "any" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "mes" + (c === 1 ? "" : "os");
    },
    function (c) {
        return "setman" + (c === 1 ? "a" : "es");
    },
    function (c) {
        return "di" + (c === 1 ? "a" : "es");
    },
    function (c) {
        return "hor" + (c === 1 ? "a" : "es");
    },
    function (c) {
        return "minut" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "segon" + (c === 1 ? "" : "s");
    },
    function (c) {
        return "milisegon" + (c === 1 ? "" : "s");
    },
    "d'aquí %s",
    "fa %s",
    ",",
);
