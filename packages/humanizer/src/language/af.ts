import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "jaar",
    (counter) => `maand${counter === 1 ? "" : "e"}`,
    (counter) => (counter === 1 ? "week" : "weke"),
    (counter) => (counter === 1 ? "dag" : "dae"),
    (counter) => (counter === 1 ? "uur" : "ure"),
    (counter) => (counter === 1 ? "minuut" : "minute"),
    (counter) => `sekonde${counter === 1 ? "" : "s"}`,
    (counter) => `millisekonde${counter === 1 ? "" : "s"}`,
    "oor %s",
    "%s gelede",
    ",",
);
