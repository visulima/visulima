import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return "Jahr" + (c === 1 ? "" : "e");
    },
    function (c) {
        return "Monat" + (c === 1 ? "" : "e");
    },
    function (c) {
        return "Woche" + (c === 1 ? "" : "n");
    },
    function (c) {
        return "Tag" + (c === 1 ? "" : "e");
    },
    function (c) {
        return "Stunde" + (c === 1 ? "" : "n");
    },
    function (c) {
        return "Minute" + (c === 1 ? "" : "n");
    },
    function (c) {
        return "Sekunde" + (c === 1 ? "" : "n");
    },
    function (c) {
        return "Millisekunde" + (c === 1 ? "" : "n");
    },
    "in %s",
    "vor %s",
    ",",
);
