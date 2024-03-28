import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return "jaro" + (c === 1 ? "" : "j");
    },
    function (c) {
        return "monato" + (c === 1 ? "" : "j");
    },
    function (c) {
        return "semajno" + (c === 1 ? "" : "j");
    },
    function (c) {
        return "tago" + (c === 1 ? "" : "j");
    },
    function (c) {
        return "horo" + (c === 1 ? "" : "j");
    },
    function (c) {
        return "minuto" + (c === 1 ? "" : "j");
    },
    function (c) {
        return "sekundo" + (c === 1 ? "" : "j");
    },
    function (c) {
        return "milisekundo" + (c === 1 ? "" : "j");
    },
    "post %s",
    "antaŭ %s",
    ",",
);
