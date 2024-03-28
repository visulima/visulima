import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return ["години", "година", "године"][getSlavicForm(c)];
    },
    function (c) {
        return ["месеци", "месец", "месеца"][getSlavicForm(c)];
    },
    function (c) {
        return ["недељи", "недеља", "недеље"][getSlavicForm(c)];
    },
    function (c) {
        return ["дани", "дан", "дана"][getSlavicForm(c)];
    },
    function (c) {
        return ["сати", "сат", "сата"][getSlavicForm(c)];
    },
    function (c) {
        return ["минута", "минут", "минута"][getSlavicForm(c)];
    },
    function (c) {
        return ["секунди", "секунда", "секунде"][getSlavicForm(c)];
    },
    function (c) {
        return ["милисекунди", "милисекунда", "милисекунде"][getSlavicForm(c)];
    },
    "за %s",
    "пре %s",
    ",",
);
