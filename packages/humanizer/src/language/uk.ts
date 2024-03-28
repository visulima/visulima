import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return ["років", "рік", "роки"][getSlavicForm(c)];
    },
    function (c) {
        return ["місяців", "місяць", "місяці"][getSlavicForm(c)];
    },
    function (c) {
        return ["тижнів", "тиждень", "тижні"][getSlavicForm(c)];
    },
    function (c) {
        return ["днів", "день", "дні"][getSlavicForm(c)];
    },
    function (c) {
        return ["годин", "година", "години"][getSlavicForm(c)];
    },
    function (c) {
        return ["хвилин", "хвилина", "хвилини"][getSlavicForm(c)];
    },
    function (c) {
        return ["секунд", "секунда", "секунди"][getSlavicForm(c)];
    },
    function (c) {
        return ["мілісекунд", "мілісекунда", "мілісекунди"][getSlavicForm(c)];
    },
    "за %s",
    "%s тому",
    ",",
);
