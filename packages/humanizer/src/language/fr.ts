import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => `an${c >= 2 ? "s" : ""}`,
    "mois",
    (c) => `semaine${c >= 2 ? "s" : ""}`,
    (c) => `jour${c >= 2 ? "s" : ""}`,
    (c) => `heure${c >= 2 ? "s" : ""}`,
    (c) => `minute${c >= 2 ? "s" : ""}`,
    (c) => `seconde${c >= 2 ? "s" : ""}`,
    (c) => `milliseconde${c >= 2 ? "s" : ""}`,
    "dans %s",
    "il y a %s",
    ",",
);
