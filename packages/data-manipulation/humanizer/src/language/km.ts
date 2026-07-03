import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Khmer aliases to standard keys
const kmUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ខ: "mo", // abbr. month
    ខែ: "mo", // khae
    ឆ: "y", // abbr. year
    ឆ្នាំ: "y", // chnam
    ថ: "d", // abbr. day
    ថ្ងៃ: "d", // thngai
    ន: "m", // abbr. minute
    នាទី: "m", // neatee
    ម: "h", // abbr. hour
    មវ: "ms", // abbr. millisecond
    មិល្លីវិនាទី: "ms", // mili vinatee
    ម៉ោង: "h", // maong
    វ: "s", // abbr. second
    វិនាទី: "s", // vinatee
    ស: "w", // abbr. week
    សប្តាហ៍: "w", // sâpdah
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "ឆ្នាំ",
    "ខែ",
    "សប្តាហ៍",
    "ថ្ងៃ",
    "ម៉ោង",
    "នាទី",
    "វិនាទី",
    "មិល្លីវិនាទី",
    "%sទៀត",
    "%sមុន",
    ".", // decimal separator
    kmUnitMap,
    ",", // group separator
    "_", // placeholder separator
);

// Note: Khmer doesn't typically use plural forms for time units in this context.
