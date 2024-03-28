import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => `año${c === 1 ? "" : "s"}`,
    (c) => `mes${c === 1 ? "" : "es"}`,
    (c) => `semana${c === 1 ? "" : "s"}`,
    (c) => `día${c === 1 ? "" : "s"}`,
    (c) => `hora${c === 1 ? "" : "s"}`,
    (c) => `minuto${c === 1 ? "" : "s"}`,
    (c) => `segundo${c === 1 ? "" : "s"}`,
    (c) => `milisegundo${c === 1 ? "" : "s"}`,
    "en %s",
    "hace %s",
    ",",
);
