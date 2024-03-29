import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    (counter) => ["години", "година", "године"][getSlavicForm(counter)] as string,
    (counter) => ["месеци", "месец", "месеца"][getSlavicForm(counter)] as string,
    (counter) => ["недељи", "недеља", "недеље"][getSlavicForm(counter)] as string,
    (counter) => ["дани", "дан", "дана"][getSlavicForm(counter)] as string,
    (counter) => ["сати", "сат", "сата"][getSlavicForm(counter)] as string,
    (counter) => ["минута", "минут", "минута"][getSlavicForm(counter)] as string,
    (counter) => ["секунди", "секунда", "секунде"][getSlavicForm(counter)] as string,
    (counter) => ["милисекунди", "милисекунда", "милисекунде"][getSlavicForm(counter)] as string,
    "за %s",
    "пре %s",
    ",",
);
