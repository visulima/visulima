import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

// Map Ukrainian aliases to standard keys
const ukUnitMap: Record<string, keyof DurationUnitMeasures> = {
    г: "h",
    год: "h",
    годин: "h",
    година: "h",
    години: "h",
    д: "d",
    день: "d",
    дні: "d",
    днів: "d",
    мілісекунд: "ms",
    мілісекунда: "ms",
    мілісекунди: "ms",
    міс: "mo",
    місяці: "mo",
    місяців: "mo",
    місяць: "mo",
    мс: "ms",
    р: "y",
    рік: "y",
    роки: "y",
    років: "y",
    с: "s",
    сек: "s",
    секунд: "s",
    секунда: "s",
    секунди: "s",
    т: "w",
    тижд: "w",
    тиждень: "w",
    тижні: "w",
    тижнів: "w",
    хв: "m",
    хвилин: "m",
    хвилина: "m",
    хвилини: "m",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
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
    ",", // decimal separator
    ukUnitMap,
    " ", // group separator (space is standard)
    "_", // placeholder separator
);
