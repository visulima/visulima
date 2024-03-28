import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => `any${c === 1 ? "" : "s"}`,
    (c) => `mes${c === 1 ? "" : "os"}`,
    (c) => `setman${c === 1 ? "a" : "es"}`,
    (c) => `di${c === 1 ? "a" : "es"}`,
    (c) => `hor${c === 1 ? "a" : "es"}`,
    (c) => `minut${c === 1 ? "" : "s"}`,
    (c) => `segon${c === 1 ? "" : "s"}`,
    (c) => `milisegon${c === 1 ? "" : "s"}`,
    "d'aquí %s",
    "fa %s",
    ",",
);
