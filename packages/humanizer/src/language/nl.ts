import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "jaar",
    (counter) => (counter === 1 ? "maand" : "maanden"),
    (counter) => (counter === 1 ? "week" : "weken"),
    (counter) => (counter === 1 ? "dag" : "dagen"),
    "uur",
    (counter) => (counter === 1 ? "minuut" : "minuten"),
    (counter) => (counter === 1 ? "seconde" : "seconden"),
    (counter) => (counter === 1 ? "milliseconde" : "milliseconden"),
    "over %s",
    "%s geleden",
    ",",
);
