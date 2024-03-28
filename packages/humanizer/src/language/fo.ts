import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "ár",
    function (c) {
        return c === 1 ? "mánaður" : "mánaðir";
    },
    function (c) {
        return c === 1 ? "vika" : "vikur";
    },
    function (c) {
        return c === 1 ? "dagur" : "dagar";
    },
    function (c) {
        return c === 1 ? "tími" : "tímar";
    },
    function (c) {
        return c === 1 ? "minuttur" : "minuttir";
    },
    "sekund",
    "millisekund",
    "um %s",
    "%s síðani",
    ",",
);
