import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => `ano${c === 1 ? "" : "s"}`,
    (c) => (c === 1 ? "mês" : "meses"),
    (c) => `semana${c === 1 ? "" : "s"}`,
    (c) => `dia${c === 1 ? "" : "s"}`,
    (c) => `hora${c === 1 ? "" : "s"}`,
    (c) => `minuto${c === 1 ? "" : "s"}`,
    (c) => `segundo${c === 1 ? "" : "s"}`,
    (c) => `milissegundo${c === 1 ? "" : "s"}`,
    "em %s",
    "há %s",
    ",",
);
