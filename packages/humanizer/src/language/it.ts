import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => `ann${c === 1 ? "o" : "i"}`,
    (c) => `mes${c === 1 ? "e" : "i"}`,
    (c) => `settiman${c === 1 ? "a" : "e"}`,
    (c) => `giorn${c === 1 ? "o" : "i"}`,
    (c) => `or${c === 1 ? "a" : "e"}`,
    (c) => `minut${c === 1 ? "o" : "i"}`,
    (c) => `second${c === 1 ? "o" : "i"}`,
    (c) => `millisecond${c === 1 ? "o" : "i"}`,
    "tra %s",
    "%s fa",
    ",",
);
