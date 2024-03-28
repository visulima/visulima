import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return c === 1 ? "an" : "ani";
    },
    function (c) {
        return c === 1 ? "lună" : "luni";
    },
    function (c) {
        return c === 1 ? "săptămână" : "săptămâni";
    },
    function (c) {
        return c === 1 ? "zi" : "zile";
    },
    function (c) {
        return c === 1 ? "oră" : "ore";
    },
    function (c) {
        return c === 1 ? "minut" : "minute";
    },
    function (c) {
        return c === 1 ? "secundă" : "secunde";
    },
    function (c) {
        return c === 1 ? "milisecundă" : "milisecunde";
    },
    "peste %s",
    "%s în urmă",
    ",",
);
