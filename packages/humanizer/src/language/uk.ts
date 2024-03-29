import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    (counter) => ["років", "рік", "роки"][getSlavicForm(counter)] as string,
    (counter) => ["місяців", "місяць", "місяці"][getSlavicForm(counter)] as string,
    (counter) => ["тижнів", "тиждень", "тижні"][getSlavicForm(counter)] as string,
    (counter) => ["днів", "день", "дні"][getSlavicForm(counter)] as string,
    (counter) => ["годин", "година", "години"][getSlavicForm(counter)] as string,
    (counter) => ["хвилин", "хвилина", "хвилини"][getSlavicForm(counter)] as string,
    (counter) => ["секунд", "секунда", "секунди"][getSlavicForm(counter)] as string,
    (counter) => ["мілісекунд", "мілісекунда", "мілісекунди"][getSlavicForm(counter)] as string,
    "за %s",
    "%s тому",
    ",",
);
