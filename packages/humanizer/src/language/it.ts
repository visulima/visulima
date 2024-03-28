import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return "ann" + (c === 1 ? "o" : "i");
    },
    function (c) {
        return "mes" + (c === 1 ? "e" : "i");
    },
    function (c) {
        return "settiman" + (c === 1 ? "a" : "e");
    },
    function (c) {
        return "giorn" + (c === 1 ? "o" : "i");
    },
    function (c) {
        return "or" + (c === 1 ? "a" : "e");
    },
    function (c) {
        return "minut" + (c === 1 ? "o" : "i");
    },
    function (c) {
        return "second" + (c === 1 ? "o" : "i");
    },
    function (c) {
        return "millisecond" + (c === 1 ? "o" : "i");
    },
    "tra %s",
    "%s fa",
    ",",
);
