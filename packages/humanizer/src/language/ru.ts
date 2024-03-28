import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return ["лет", "год", "года"][getSlavicForm(c)];
    },
    function (c) {
        return ["месяцев", "месяц", "месяца"][getSlavicForm(c)];
    },
    function (c) {
        return ["недель", "неделя", "недели"][getSlavicForm(c)];
    },
    function (c) {
        return ["дней", "день", "дня"][getSlavicForm(c)];
    },
    function (c) {
        return ["часов", "час", "часа"][getSlavicForm(c)];
    },
    function (c) {
        return ["минут", "минута", "минуты"][getSlavicForm(c)];
    },
    function (c) {
        return ["секунд", "секунда", "секунды"][getSlavicForm(c)];
    },
    function (c) {
        return ["миллисекунд", "миллисекунда", "миллисекунды"][getSlavicForm(c)];
    },
    "через %s",
    "%s назад",
    ",",
);
