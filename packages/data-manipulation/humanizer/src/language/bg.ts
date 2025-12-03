import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

// Map Bulgarian aliases to standard keys
const bgUnitMap: Record<string, keyof DurationUnitMeasures> = {
    година: "y",
    години: "y",
    ден: "d",
    дни: "d",
    месец: "mo",
    месеца: "mo",
    милисекунда: "ms",
    милисекунди: "ms",
    минута: "m",
    минути: "m",
    седмица: "w",
    седмици: "w",
    секунда: "s",
    секунди: "s",
    час: "h",
    часа: "h",
};

export const durationLanguage: DurationLanguage = createDurationLanguage(
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
    ",", // decimal
    bgUnitMap,
    " ", // groupSeparator (space)
    "_", // placeholderSeparator
);
