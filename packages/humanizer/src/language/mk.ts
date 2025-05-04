import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Macedonian aliases to standard keys
const mkUnitMap: Record<string, keyof DurationUnitMeasures> = {
    г: "y",
    год: "y",
    година: "y",
    години: "y",
    д: "d",
    ден: "d",
    дена: "d",
    м: "mo",
    мес: "mo",
    месец: "mo",
    месеци: "mo",
    милисекунда: "ms",
    милисекунди: "ms",
    мин: "m",
    минута: "m",
    минути: "m",
    мс: "ms",
    н: "w",
    нед: "w",
    недела: "w",
    недели: "w",
    с: "s",
    сек: "s",
    секунда: "s",
    секунди: "s",
    ч: "h",
    час: "h",
    часа: "h",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "година" : "години"),
    (counter) => (counter === 1 ? "месец" : "месеци"),
    (counter) => (counter === 1 ? "недела" : "недели"),
    (counter) => (counter === 1 ? "ден" : "дена"),
    (counter) => (counter === 1 ? "час" : "часа"),
    (counter) => (counter === 1 ? "минута" : "минути"),
    (counter) => (counter === 1 ? "секунда" : "секунди"),
    (counter) => (counter === 1 ? "милисекунда" : "милисекунди"),
    "за %s", // "in %s"
    "пред %s", // "%s ago"
    ",", // decimal separator in Macedonian
    mkUnitMap,
    " ", // group separator in Macedonian
    "_", // placeholder separator
);
