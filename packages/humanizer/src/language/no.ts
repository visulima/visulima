import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "år",
    (c) => `måned${c === 1 ? "" : "er"}`,
    (c) => `uke${c === 1 ? "" : "r"}`,
    (c) => `dag${c === 1 ? "" : "er"}`,
    (c) => `time${c === 1 ? "" : "r"}`,
    (c) => `minutt${c === 1 ? "" : "er"}`,
    (c) => `sekund${c === 1 ? "" : "er"}`,
    (c) => `millisekund${c === 1 ? "" : "er"}`,
    "om %s",
    "%s siden",
    ",",
);
