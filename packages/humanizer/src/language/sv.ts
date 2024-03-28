import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "år",
    function (c) {
        return "månad" + (c === 1 ? "" : "er");
    },
    function (c) {
        return "veck" + (c === 1 ? "a" : "or");
    },
    function (c) {
        return "dag" + (c === 1 ? "" : "ar");
    },
    function (c) {
        return "timm" + (c === 1 ? "e" : "ar");
    },
    function (c) {
        return "minut" + (c === 1 ? "" : "er");
    },
    function (c) {
        return "sekund" + (c === 1 ? "" : "er");
    },
    function (c) {
        return "millisekund" + (c === 1 ? "" : "er");
    },
    "om %s",
    "för %s sedan",
    ",",
);
