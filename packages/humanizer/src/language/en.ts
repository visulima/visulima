import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `year${counter === 1 ? "" : "s"}`,
    (counter) => `month${counter === 1 ? "" : "s"}`,
    (counter) => `week${counter === 1 ? "" : "s"}`,
    (counter) => `day${counter === 1 ? "" : "s"}`,
    (counter) => `hour${counter === 1 ? "" : "s"}`,
    (counter) => `minute${counter === 1 ? "" : "s"}`,
    (counter) => `second${counter === 1 ? "" : "s"}`,
    (counter) => `millisecond${counter === 1 ? "" : "s"}`,
    "in %s",
    "%s ago",
);
