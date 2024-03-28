import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "ár",
    (counter) => (counter === 1 ? "mánaður" : "mánaðir"),
    (counter) => (counter === 1 ? "vika" : "vikur"),
    (counter) => (counter === 1 ? "dagur" : "dagar"),
    (counter) => (counter === 1 ? "tími" : "tímar"),
    (counter) => (counter === 1 ? "minuttur" : "minuttir"),
    "sekund",
    "millisekund",
    "um %s",
    "%s síðani",
    ",",
);
