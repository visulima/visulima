import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    (c) => ["лет", "год", "года"][getSlavicForm(c)],
    (c) => ["месяцев", "месяц", "месяца"][getSlavicForm(c)],
    (c) => ["недель", "неделя", "недели"][getSlavicForm(c)],
    (c) => ["дней", "день", "дня"][getSlavicForm(c)],
    (c) => ["часов", "час", "часа"][getSlavicForm(c)],
    (c) => ["минут", "минута", "минуты"][getSlavicForm(c)],
    (c) => ["секунд", "секунда", "секунды"][getSlavicForm(c)],
    (c) => ["миллисекунд", "миллисекунда", "миллисекунды"][getSlavicForm(c)],
    "через %s",
    "%s назад",
    ",",
);
