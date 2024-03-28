import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "år",
    function (c) {
        return "måned" + (c === 1 ? "" : "er");
    },
    function (c) {
        return "uke" + (c === 1 ? "" : "r");
    },
    function (c) {
        return "dag" + (c === 1 ? "" : "er");
    },
    function (c) {
        return "time" + (c === 1 ? "" : "r");
    },
    function (c) {
        return "minutt" + (c === 1 ? "" : "er");
    },
    function (c) {
        return "sekund" + (c === 1 ? "" : "er");
    },
    function (c) {
        return "millisekund" + (c === 1 ? "" : "er");
    },
    "om %s",
    "%s siden",
    ",",
);
