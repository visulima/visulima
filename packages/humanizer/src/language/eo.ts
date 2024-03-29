import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `jaro${counter === 1 ? "" : "j"}`,
    (counter) => `monato${counter === 1 ? "" : "j"}`,
    (counter) => `semajno${counter === 1 ? "" : "j"}`,
    (counter) => `tago${counter === 1 ? "" : "j"}`,
    (counter) => `horo${counter === 1 ? "" : "j"}`,
    (counter) => `minuto${counter === 1 ? "" : "j"}`,
    (counter) => `sekundo${counter === 1 ? "" : "j"}`,
    (counter) => `milisekundo${counter === 1 ? "" : "j"}`,
    "post %s",
    "antaŭ %s",
    ",",
);
