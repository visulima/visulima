import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "år",
    (c) => `månad${c === 1 ? "" : "er"}`,
    (c) => `veck${c === 1 ? "a" : "or"}`,
    (c) => `dag${c === 1 ? "" : "ar"}`,
    (c) => `timm${c === 1 ? "e" : "ar"}`,
    (c) => `minut${c === 1 ? "" : "er"}`,
    (c) => `sekund${c === 1 ? "" : "er"}`,
    (c) => `millisekund${c === 1 ? "" : "er"}`,
    "om %s",
    "för %s sedan",
    ",",
);
