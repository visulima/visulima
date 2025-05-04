import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

// Map Russian aliases to standard keys
const ruUnitMap: Record<string, keyof DurationUnitMeasures> = {
    c: "s",
    г: "y",
    год: "y",
    года: "y",
    д: "d",
    день: "d",
    дней: "d",
    дня: "d",
    лет: "y",
    мес: "mo",
    месяц: "mo",
    месяца: "mo",
    месяцев: "mo",
    миллисекунд: "ms",
    миллисекунда: "ms",
    миллисекунды: "ms",
    мин: "m",
    минут: "m",
    минута: "m",
    минуты: "m",
    мс: "ms",
    нед: "w",
    недели: "w",
    недель: "w",
    неделя: "w",
    сек: "s",
    секунд: "s",
    секунда: "s",
    секунды: "s",
    ч: "h",
    час: "h",
    часа: "h",
    часов: "h",
} as const;

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
    ",", // decimal
    ruUnitMap,
    " ", // groupSeparator (space in Russian)
    "_", // placeholderSeparator
);
