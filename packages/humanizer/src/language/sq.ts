import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => (c === 1 ? "vit" : "vjet"),
    "muaj",
    "javë",
    "ditë",
    "orë",
    (c) => `minut${c === 1 ? "ë" : "a"}`,
    (c) => `sekond${c === 1 ? "ë" : "a"}`,
    (c) => `milisekond${c === 1 ? "ë" : "a"}`,
    "në %s",
    "%s më parë",
    ",",
);
