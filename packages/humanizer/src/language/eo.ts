import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => `jaro${c === 1 ? "" : "j"}`,
    (c) => `monato${c === 1 ? "" : "j"}`,
    (c) => `semajno${c === 1 ? "" : "j"}`,
    (c) => `tago${c === 1 ? "" : "j"}`,
    (c) => `horo${c === 1 ? "" : "j"}`,
    (c) => `minuto${c === 1 ? "" : "j"}`,
    (c) => `sekundo${c === 1 ? "" : "j"}`,
    (c) => `milisekundo${c === 1 ? "" : "j"}`,
    "post %s",
    "antaŭ %s",
    ",",
);
