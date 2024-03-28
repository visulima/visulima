import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return "aasta" + (c === 1 ? "" : "t");
    },
    function (c) {
        return "kuu" + (c === 1 ? "" : "d");
    },
    function (c) {
        return "nädal" + (c === 1 ? "" : "at");
    },
    function (c) {
        return "päev" + (c === 1 ? "" : "a");
    },
    function (c) {
        return "tund" + (c === 1 ? "" : "i");
    },
    function (c) {
        return "minut" + (c === 1 ? "" : "it");
    },
    function (c) {
        return "sekund" + (c === 1 ? "" : "it");
    },
    function (c) {
        return "millisekund" + (c === 1 ? "" : "it");
    },
    "%s pärast",
    "%s tagasi",
    ",",
);
