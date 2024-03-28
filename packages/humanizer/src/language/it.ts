import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `ann${counter === 1 ? "o" : "i"}`,
    (counter) => `mes${counter === 1 ? "e" : "i"}`,
    (counter) => `settiman${counter === 1 ? "a" : "e"}`,
    (counter) => `giorn${counter === 1 ? "o" : "i"}`,
    (counter) => `or${counter === 1 ? "a" : "e"}`,
    (counter) => `minut${counter === 1 ? "o" : "i"}`,
    (counter) => `second${counter === 1 ? "o" : "i"}`,
    (counter) => `millisecond${counter === 1 ? "o" : "i"}`,
    "tra %s",
    "%s fa",
    ",",
);
