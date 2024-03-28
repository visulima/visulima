import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "ár",
    (c) => (c === 1 ? "mánaður" : "mánaðir"),
    (c) => (c === 1 ? "vika" : "vikur"),
    (c) => (c === 1 ? "dagur" : "dagar"),
    (c) => (c === 1 ? "tími" : "tímar"),
    (c) => (c === 1 ? "minuttur" : "minuttir"),
    "sekund",
    "millisekund",
    "um %s",
    "%s síðani",
    ",",
);
