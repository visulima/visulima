import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "an" : "ani"),
    (counter) => (counter === 1 ? "lună" : "luni"),
    (counter) => (counter === 1 ? "săptămână" : "săptămâni"),
    (counter) => (counter === 1 ? "zi" : "zile"),
    (counter) => (counter === 1 ? "oră" : "ore"),
    (counter) => (counter === 1 ? "minut" : "minute"),
    (counter) => (counter === 1 ? "secundă" : "secunde"),
    (counter) => (counter === 1 ? "milisecundă" : "milisecunde"),
    "peste %s",
    "%s în urmă",
    ",",
);
