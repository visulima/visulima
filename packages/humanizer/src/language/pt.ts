import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `ano${counter === 1 ? "" : "s"}`,
    (counter) => (counter === 1 ? "mês" : "meses"),
    (counter) => `semana${counter === 1 ? "" : "s"}`,
    (counter) => `dia${counter === 1 ? "" : "s"}`,
    (counter) => `hora${counter === 1 ? "" : "s"}`,
    (counter) => `minuto${counter === 1 ? "" : "s"}`,
    (counter) => `segundo${counter === 1 ? "" : "s"}`,
    (counter) => `milissegundo${counter === 1 ? "" : "s"}`,
    "em %s",
    "há %s",
    ",",
);
