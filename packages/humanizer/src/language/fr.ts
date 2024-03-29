import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `an${counter >= 2 ? "s" : ""}`,
    "mois",
    (counter) => `semaine${counter >= 2 ? "s" : ""}`,
    (counter) => `jour${counter >= 2 ? "s" : ""}`,
    (counter) => `heure${counter >= 2 ? "s" : ""}`,
    (counter) => `minute${counter >= 2 ? "s" : ""}`,
    (counter) => `seconde${counter >= 2 ? "s" : ""}`,
    (counter) => `milliseconde${counter >= 2 ? "s" : ""}`,
    "dans %s",
    "il y a %s",
    ",",
);
