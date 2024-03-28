import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "jaar",
    function (c) {
        return c === 1 ? "maand" : "maanden";
    },
    function (c) {
        return c === 1 ? "week" : "weken";
    },
    function (c) {
        return c === 1 ? "dag" : "dagen";
    },
    "uur",
    function (c) {
        return c === 1 ? "minuut" : "minuten";
    },
    function (c) {
        return c === 1 ? "seconde" : "seconden";
    },
    function (c) {
        return c === 1 ? "milliseconde" : "milliseconden";
    },
    "over %s",
    "%s geleden",
    ",",
);
