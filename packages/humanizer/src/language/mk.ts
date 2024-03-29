import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "година" : "години"),
    (counter) => (counter === 1 ? "месец" : "месеци"),
    (counter) => (counter === 1 ? "недела" : "недели"),
    (counter) => (counter === 1 ? "ден" : "дена"),
    (counter) => (counter === 1 ? "час" : "часа"),
    (counter) => (counter === 1 ? "минута" : "минути"),
    (counter) => (counter === 1 ? "секунда" : "секунди"),
    (counter) => (counter === 1 ? "милисекунда" : "милисекунди"),
    "за %s",
    "пред %s",
    ",",
);
