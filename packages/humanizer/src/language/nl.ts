import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "jaar",
    (c) => (c === 1 ? "maand" : "maanden"),
    (c) => (c === 1 ? "week" : "weken"),
    (c) => (c === 1 ? "dag" : "dagen"),
    "uur",
    (c) => (c === 1 ? "minuut" : "minuten"),
    (c) => (c === 1 ? "seconde" : "seconden"),
    (c) => (c === 1 ? "milliseconde" : "milliseconden"),
    "over %s",
    "%s geleden",
    ",",
);
