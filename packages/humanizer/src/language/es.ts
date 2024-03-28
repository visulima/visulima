import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `año${counter === 1 ? "" : "s"}`,
    (counter) => `mes${counter === 1 ? "" : "es"}`,
    (counter) => `semana${counter === 1 ? "" : "s"}`,
    (counter) => `día${counter === 1 ? "" : "s"}`,
    (counter) => `hora${counter === 1 ? "" : "s"}`,
    (counter) => `minuto${counter === 1 ? "" : "s"}`,
    (counter) => `segundo${counter === 1 ? "" : "s"}`,
    (counter) => `milisegundo${counter === 1 ? "" : "s"}`,
    "en %s",
    "hace %s",
    ",",
);
