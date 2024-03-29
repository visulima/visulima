import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "år",
    (counter) => `måned${counter === 1 ? "" : "er"}`,
    (counter) => `uge${counter === 1 ? "" : "r"}`,
    (counter) => `dag${counter === 1 ? "" : "e"}`,
    (counter) => `time${counter === 1 ? "" : "r"}`,
    (counter) => `minut${counter === 1 ? "" : "ter"}`,
    (counter) => `sekund${counter === 1 ? "" : "er"}`,
    (counter) => `millisekund${counter === 1 ? "" : "er"}`,
    "om %s",
    "%s siden",
    ",",
);
