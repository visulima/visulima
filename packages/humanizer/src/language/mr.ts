import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "वर्ष" : "वर्षे"),
    (counter) => (counter === 1 ? "महिना" : "महिने"),
    (counter) => (counter === 1 ? "आठवडा" : "आठवडे"),
    "दिवस",
    "तास",
    (counter) => (counter === 1 ? "मिनिट" : "मिनिटे"),
    "सेकंद",
    "मिलिसेकंद",
    "%sमध्ये",
    "%sपूर्वी",
);
