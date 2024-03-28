import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return c === 1 ? "година" : "години";
    },
    function (c) {
        return c === 1 ? "месец" : "месеци";
    },
    function (c) {
        return c === 1 ? "недела" : "недели";
    },
    function (c) {
        return c === 1 ? "ден" : "дена";
    },
    function (c) {
        return c === 1 ? "час" : "часа";
    },
    function (c) {
        return c === 1 ? "минута" : "минути";
    },
    function (c) {
        return c === 1 ? "секунда" : "секунди";
    },
    function (c) {
        return c === 1 ? "милисекунда" : "милисекунди";
    },
    "за %s",
    "пред %s",
    ",",
);
