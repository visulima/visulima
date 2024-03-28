import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    (c) => ["години", "година", "године"][getSlavicForm(c)],
    (c) => ["месеци", "месец", "месеца"][getSlavicForm(c)],
    (c) => ["недељи", "недеља", "недеље"][getSlavicForm(c)],
    (c) => ["дани", "дан", "дана"][getSlavicForm(c)],
    (c) => ["сати", "сат", "сата"][getSlavicForm(c)],
    (c) => ["минута", "минут", "минута"][getSlavicForm(c)],
    (c) => ["секунди", "секунда", "секунде"][getSlavicForm(c)],
    (c) => ["милисекунди", "милисекунда", "милисекунде"][getSlavicForm(c)],
    "за %s",
    "пре %s",
    ",",
);
