import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Mongolian aliases to standard keys
const mnUnitMap: Record<string, keyof DurationUnitMeasures> = {
    "долоо хоног": "w",
    долоохоног: "w",
    дх: "w",
    ж: "y",
    жил: "y",
    м: "m",
    миллисекунд: "ms",
    мин: "m",
    минут: "m",
    мс: "ms",
    мсек: "ms",
    он: "y",
    с: "s",
    сар: "mo",
    сек: "s",
    секунд: "s",
    ц: "h",
    цаг: "h",
    ө: "d",
    өд: "d",
    өдөр: "d",
} as const;

// Mongolian doesn't use plural forms for time units
export const durationLanguage = createDurationLanguage(
    "жил",
    "сар",
    "долоо хоног",
    "өдөр",
    "цаг",
    "минут",
    "секунд",
    "миллисекунд",
    "%s дараа",
    "%s өмнө",
    ".", // decimal separator in Mongolian
    mnUnitMap,
    ",", // group separator in Mongolian
    "_", // placeholder separator
);
