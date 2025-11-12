import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

// Map Serbian aliases (Cyrillic and Latin) to standard keys
const srUnitMap: Record<string, keyof DurationUnitMeasures> = {
    dan: "d",
    dana: "d",
    // Latin equivalents
    godina: "y",
    godine: "y",
    godinu: "y",
    mesec: "mo",
    meseca: "mo",
    meseci: "mo",
    milisekunda: "ms",
    milisekunde: "ms",
    milisekundi: "ms",
    minut: "m",
    minuta: "m",
    ms: "ms",
    nedelja: "w",
    nedelje: "w",
    nedelju: "w",
    sat: "h",
    sata: "h",
    sati: "h",
    sekunda: "s",
    sekunde: "s",
    sekundi: "s",
    г: "y",
    // Cyrillic
    година: "y",
    године: "y",
    годину: "y",
    д: "d",
    дан: "d",
    дана: "d",
    месец: "mo",
    месеца: "mo",
    месеци: "mo",
    милисекунда: "ms",
    милисекунде: "ms",
    милисекунди: "ms",
    мин: "m",
    минут: "m",
    минута: "m",
    мс: "ms",
    нед: "w", // Недеља
    недеља: "w",
    недеље: "w",
    недељу: "w",
    с: "s",
    сат: "h",
    сата: "h",
    сати: "h",
    сек: "s",
    секунда: "s",
    секунде: "s",
    секунди: "s",
    ч: "h", // час
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
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
    ",", // decimal separator
    srUnitMap,
    ".", // group separator
    "_", // placeholder separator
);
