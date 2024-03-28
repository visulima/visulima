import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "ár",
    function (c) {
        return "mánuð" + (c === 1 ? "ur" : "ir");
    },
    function (c) {
        return "vik" + (c === 1 ? "a" : "ur");
    },
    function (c) {
        return "dag" + (c === 1 ? "ur" : "ar");
    },
    function (c) {
        return "klukkutím" + (c === 1 ? "i" : "ar");
    },
    function (c) {
        return "mínút" + (c === 1 ? "a" : "ur");
    },
    function (c) {
        return "sekúnd" + (c === 1 ? "a" : "ur");
    },
    function (c) {
        return "millisekúnd" + (c === 1 ? "a" : "ur");
    },
    "eftir %s",
    "fyrir %s síðan",
);
