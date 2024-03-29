import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "år",
    (counter) => `månad${counter === 1 ? "" : "er"}`,
    (counter) => `veck${counter === 1 ? "a" : "or"}`,
    (counter) => `dag${counter === 1 ? "" : "ar"}`,
    (counter) => `timm${counter === 1 ? "e" : "ar"}`,
    (counter) => `minut${counter === 1 ? "" : "er"}`,
    (counter) => `sekund${counter === 1 ? "" : "er"}`,
    (counter) => `millisekund${counter === 1 ? "" : "er"}`,
    "om %s",
    "för %s sedan",
    ",",
);
