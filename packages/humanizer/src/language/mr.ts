import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => (c === 1 ? "वर्ष" : "वर्षे"),
    (c) => (c === 1 ? "महिना" : "महिने"),
    (c) => (c === 1 ? "आठवडा" : "आठवडे"),
    "दिवस",
    "तास",
    (c) => (c === 1 ? "मिनिट" : "मिनिटे"),
    "सेकंद",
    "मिलिसेकंद",
    "%sमध्ये",
    "%sपूर्वी",
);
