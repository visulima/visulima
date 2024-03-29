import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `any${counter === 1 ? "" : "s"}`,
    (counter) => `mes${counter === 1 ? "" : "os"}`,
    (counter) => `setman${counter === 1 ? "a" : "es"}`,
    (counter) => `di${counter === 1 ? "a" : "es"}`,
    (counter) => `hor${counter === 1 ? "a" : "es"}`,
    (counter) => `minut${counter === 1 ? "" : "s"}`,
    (counter) => `segon${counter === 1 ? "" : "s"}`,
    (counter) => `milisegon${counter === 1 ? "" : "s"}`,
    "d'aquí %s",
    "fa %s",
    ",",
);
