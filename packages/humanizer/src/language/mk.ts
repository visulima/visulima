import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => (c === 1 ? "година" : "години"),
    (c) => (c === 1 ? "месец" : "месеци"),
    (c) => (c === 1 ? "недела" : "недели"),
    (c) => (c === 1 ? "ден" : "дена"),
    (c) => (c === 1 ? "час" : "часа"),
    (c) => (c === 1 ? "минута" : "минути"),
    (c) => (c === 1 ? "секунда" : "секунди"),
    (c) => (c === 1 ? "милисекунда" : "милисекунди"),
    "за %s",
    "пред %s",
    ",",
);
