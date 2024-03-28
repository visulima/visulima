import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return c === 1 ? "vit" : "vjet";
    },
    "muaj",
    "javë",
    "ditë",
    "orë",
    function (c) {
        return "minut" + (c === 1 ? "ë" : "a");
    },
    function (c) {
        return "sekond" + (c === 1 ? "ë" : "a");
    },
    function (c) {
        return "milisekond" + (c === 1 ? "ë" : "a");
    },
    "në %s",
    "%s më parë",
    ",",
);
