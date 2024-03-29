import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    (counter) => ["лет", "год", "года"][getSlavicForm(counter)] as string,
    (counter) => ["месяцев", "месяц", "месяца"][getSlavicForm(counter)] as string,
    (counter) => ["недель", "неделя", "недели"][getSlavicForm(counter)] as string,
    (counter) => ["дней", "день", "дня"][getSlavicForm(counter)] as string,
    (counter) => ["часов", "час", "часа"][getSlavicForm(counter)] as string,
    (counter) => ["минут", "минута", "минуты"][getSlavicForm(counter)] as string,
    (counter) => ["секунд", "секунда", "секунды"][getSlavicForm(counter)] as string,
    (counter) => ["миллисекунд", "миллисекунда", "миллисекунды"][getSlavicForm(counter)] as string,
    "через %s",
    "%s назад",
    ",",
);
