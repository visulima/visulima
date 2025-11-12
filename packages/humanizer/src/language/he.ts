import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Hebrew aliases to standard keys
const heUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ms: "ms",
    "ד'": "m",
    דקה: "m",
    דקות: "m",
    "ח'": "mo",
    חודש: "mo",
    חודשים: "mo",
    "י'": "d",
    יום: "d",
    ימים: "d",
    "מא'": "ms", // often stands for millisecond
    מילישניה: "ms",
    מילישניות: "ms",
    "ש'": "y",
    "שב'": "w", // Final attempt at order
    שבוע: "w",
    שבועות: "w",
    "שנ'": "s",
    שנה: "y",
    שניה: "s",
    שניות: "s",
    שנים: "y",
    "שע'": "h",
    שעה: "h",
    שעות: "h",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "שנה" : "שנים"),
    (counter) => (counter === 1 ? "חודש" : "חודשים"),
    (counter) => (counter === 1 ? "שבוע" : "שבועות"),
    (counter) => (counter === 1 ? "יום" : "ימים"),
    (counter) => (counter === 1 ? "שעה" : "שעות"),
    (counter) => (counter === 1 ? "דקה" : "דקות"),
    (counter) => (counter === 1 ? "שניה" : "שניות"),
    (counter) => (counter === 1 ? "מילישנייה" : "מילישניות"),
    "בעוד %s",
    "לפני %s",
    ".", // decimal separator (often .)
    heUnitMap,
    ",", // group separator (often ,)
    "_", // placeholder separator
);
