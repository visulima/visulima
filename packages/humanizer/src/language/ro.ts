import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => (c === 1 ? "an" : "ani"),
    (c) => (c === 1 ? "lună" : "luni"),
    (c) => (c === 1 ? "săptămână" : "săptămâni"),
    (c) => (c === 1 ? "zi" : "zile"),
    (c) => (c === 1 ? "oră" : "ore"),
    (c) => (c === 1 ? "minut" : "minute"),
    (c) => (c === 1 ? "secundă" : "secunde"),
    (c) => (c === 1 ? "milisecundă" : "milisecunde"),
    "peste %s",
    "%s în urmă",
    ",",
);
