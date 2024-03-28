import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    (c) => ["років", "рік", "роки"][getSlavicForm(c)],
    (c) => ["місяців", "місяць", "місяці"][getSlavicForm(c)],
    (c) => ["тижнів", "тиждень", "тижні"][getSlavicForm(c)],
    (c) => ["днів", "день", "дні"][getSlavicForm(c)],
    (c) => ["годин", "година", "години"][getSlavicForm(c)],
    (c) => ["хвилин", "хвилина", "хвилини"][getSlavicForm(c)],
    (c) => ["секунд", "секунда", "секунди"][getSlavicForm(c)],
    (c) => ["мілісекунд", "мілісекунда", "мілісекунди"][getSlavicForm(c)],
    "за %s",
    "%s тому",
    ",",
);
