import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "år",
    (c) => `måned${c === 1 ? "" : "er"}`,
    (c) => `uge${c === 1 ? "" : "r"}`,
    (c) => `dag${c === 1 ? "" : "e"}`,
    (c) => `time${c === 1 ? "" : "r"}`,
    (c) => `minut${c === 1 ? "" : "ter"}`,
    (c) => `sekund${c === 1 ? "" : "er"}`,
    (c) => `millisekund${c === 1 ? "" : "er"}`,
    "om %s",
    "%s siden",
    ",",
);
