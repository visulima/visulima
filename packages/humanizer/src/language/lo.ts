import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Lao aliases to standard keys
const loUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ms: "ms",
    ຊມ: "h", // abbr. hour
    ຊົ່ວໂມງ: "h", // suamong
    ດ: "mo", // abbr. month
    ເດືອນ: "mo", // deuan
    ທ: "w", // abbr. week
    ນທ: "m", // abbr. minute
    ນາທີ: "m", // nathi
    ປ: "y", // abbr. year
    ປີ: "y", // pi
    ມ: "d", // abbr. day
    ມລວທ: "ms", // abbr. millisecond
    ມິນລິວິນາທີ: "ms", // mili vinathi
    ມື້: "d", // meu
    ວທ: "s", // abbr. second
    ວິນາທີ: "s", // vinathi
    ອາທິດ: "w", // athit
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "ປີ",
    "ເດືອນ",
    "ອາທິດ",
    "ມື້",
    "ຊົ່ວໂມງ",
    "ນາທີ",
    "ວິນາທີ",
    "ມິນລິວິນາທີ",
    "ອີກ %s",
    "%sຜ່ານມາ",
    ".", // decimal separator
    loUnitMap,
    ",", // group separator
    "_", // placeholder separator
);

// Note: Lao doesn't typically use plural forms for time units.
