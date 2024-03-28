import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "jaar",
    function (counter) {
        return "maand" + (counter === 1 ? "" : "e");
    },
    function (counter) {
        return counter === 1 ? "week" : "weke";
    },
    function (counter) {
        return counter === 1 ? "dag" : "dae";
    },
    function (counter) {
        return counter === 1 ? "uur" : "ure";
    },
    function (counter) {
        return counter === 1 ? "minuut" : "minute";
    },
    function (counter) {
        return "sekonde" + (counter === 1 ? "" : "s");
    },
    function (counter) {
        return "millisekonde" + (counter === 1 ? "" : "s");
    },
    "oor %s",
    "%s gelede",
    ",",
);
