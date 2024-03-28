import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return c === 1 ? "वर्ष" : "वर्षे";
    },
    function (c) {
        return c === 1 ? "महिना" : "महिने";
    },
    function (c) {
        return c === 1 ? "आठवडा" : "आठवडे";
    },
    "दिवस",
    "तास",
    function (c) {
        return c === 1 ? "मिनिट" : "मिनिटे";
    },
    "सेकंद",
    "मिलिसेकंद",
    "%sमध्ये",
    "%sपूर्वी",
);
