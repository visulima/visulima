import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Marathi aliases to standard keys
const mrUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ms: "ms",
    आ: "w",
    आठवडा: "w",
    आठवडे: "w",
    ता: "h",
    तास: "h",
    दि: "d",
    दिवस: "d",
    म: "mo",
    महिना: "mo",
    महिने: "mo",
    मि: "m",
    मिनिट: "m",
    मिनिटे: "m",
    मिलिसे: "ms",
    मिलिसेकंद: "ms",
    व: "y",
    वर्ष: "y",
    वर्षे: "y",
    से: "s",
    सेकंद: "s",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "वर्ष" : "वर्षे"),
    (counter) => (counter === 1 ? "महिना" : "महिने"),
    (counter) => (counter === 1 ? "आठवडा" : "आठवडे"),
    "दिवस",
    "तास",
    (counter) => (counter === 1 ? "मिनिट" : "मिनिटे"),
    "सेकंद",
    "मिलिसेकंद",
    "%s मध्ये",
    "%s पूर्वी",
    ".",
    mrUnitMap,
    ",",
    "_",
);
