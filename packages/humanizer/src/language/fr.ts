import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return "an" + (c >= 2 ? "s" : "");
    },
    "mois",
    function (c) {
        return "semaine" + (c >= 2 ? "s" : "");
    },
    function (c) {
        return "jour" + (c >= 2 ? "s" : "");
    },
    function (c) {
        return "heure" + (c >= 2 ? "s" : "");
    },
    function (c) {
        return "minute" + (c >= 2 ? "s" : "");
    },
    function (c) {
        return "seconde" + (c >= 2 ? "s" : "");
    },
    function (c) {
        return "milliseconde" + (c >= 2 ? "s" : "");
    },
    "dans %s",
    "il y a %s",
    ",",
);
