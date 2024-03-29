import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "år",
    (counter) => `måned${counter === 1 ? "" : "er"}`,
    (counter) => `uke${counter === 1 ? "" : "r"}`,
    (counter) => `dag${counter === 1 ? "" : "er"}`,
    (counter) => `time${counter === 1 ? "" : "r"}`,
    (counter) => `minutt${counter === 1 ? "" : "er"}`,
    (counter) => `sekund${counter === 1 ? "" : "er"}`,
    (counter) => `millisekund${counter === 1 ? "" : "er"}`,
    "om %s",
    "%s siden",
    ",",
);
