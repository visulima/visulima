import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return c === 1 ? "vuosi" : "vuotta";
    },
    function (c) {
        return c === 1 ? "kuukausi" : "kuukautta";
    },
    function (c) {
        return "viikko" + (c === 1 ? "" : "a");
    },
    function (c) {
        return "päivä" + (c === 1 ? "" : "ä");
    },
    function (c) {
        return "tunti" + (c === 1 ? "" : "a");
    },
    function (c) {
        return "minuutti" + (c === 1 ? "" : "a");
    },
    function (c) {
        return "sekunti" + (c === 1 ? "" : "a");
    },
    function (c) {
        return "millisekunti" + (c === 1 ? "" : "a");
    },
    "%s päästä",
    "%s sitten",
    ",",
);
