import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map English aliases to standard keys
export const englishUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    day: "d",
    days: "d",
    h: "h",
    hour: "h",
    hours: "h",
    hr: "h",
    hrs: "h",
    m: "m",
    millisecond: "ms",
    milliseconds: "ms",
    min: "m",
    mins: "m",
    minute: "m",
    minutes: "m",
    mo: "mo",
    month: "mo",
    months: "mo",
    ms: "ms",
    s: "s",
    sec: "s",
    second: "s",
    seconds: "s",
    secs: "s",
    w: "w",
    week: "w",
    weeks: "w",
    y: "y",
    year: "y",
    years: "y",
    yr: "y",
    yrs: "y",
};

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => `year${counter === 1 ? "" : "s"}`,
    (counter) => `month${counter === 1 ? "" : "s"}`,
    (counter) => `week${counter === 1 ? "" : "s"}`,
    (counter) => `day${counter === 1 ? "" : "s"}`,
    (counter) => `hour${counter === 1 ? "" : "s"}`,
    (counter) => `minute${counter === 1 ? "" : "s"}`,
    (counter) => `second${counter === 1 ? "" : "s"}`,
    (counter) => `millisecond${counter === 1 ? "" : "s"}`,
    "in %s",
    "%s ago",
    ".", // decimal
    englishUnitMap,
    ",", // groupSeparator
    "_", // placeholderSeparator
);
