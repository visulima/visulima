import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    (counter) => ["години", "година", "години"][getSlavicForm(counter)] as string,
    (counter) => ["месеца", "месец", "месеца"][getSlavicForm(counter)] as string,
    (counter) => ["седмици", "седмица", "седмици"][getSlavicForm(counter)] as string,
    (counter) => ["дни", "ден", "дни"][getSlavicForm(counter)] as string,
    (counter) => ["часа", "час", "часа"][getSlavicForm(counter)] as string,
    (counter) => ["минути", "минута", "минути"][getSlavicForm(counter)] as string,
    (counter) => ["секунди", "секунда", "секунди"][getSlavicForm(counter)] as string,
    (counter) => ["милисекунди", "милисекунда", "милисекунди"][getSlavicForm(counter)] as string,
    "след %s",
    "преди %s",
    ",",
);
