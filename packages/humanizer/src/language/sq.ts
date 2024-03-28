import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "vit" : "vjet"),
    "muaj",
    "javë",
    "ditë",
    "orë",
    (counter) => `minut${counter === 1 ? "ë" : "a"}`,
    (counter) => `sekond${counter === 1 ? "ë" : "a"}`,
    (counter) => `milisekond${counter === 1 ? "ë" : "a"}`,
    "në %s",
    "%s më parë",
    ",",
);
