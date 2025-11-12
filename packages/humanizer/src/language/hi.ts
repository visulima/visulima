import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Hindi aliases to standard keys
const hiUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ms: "ms",
    घं: "h",
    घंटा: "h",
    घंटे: "h",
    दि: "d",
    दिन: "d",
    दिनों: "d",
    दिवस: "d",
    म: "mo",
    महीना: "mo",
    महीने: "mo",
    माह: "mo",
    मि: "m",
    मिनट: "m",
    मिनिट: "m",
    मिलीसेकंड: "ms",
    मिलीसेकेंड: "ms",
    मिसे: "ms",
    व: "y",
    वर्ष: "y",
    वर्षों: "y",
    स: "w",
    सप्ताह: "w",
    साल: "y",
    सालों: "y",
    से: "s",
    सेकंड: "s",
    सेकेंड: "s",
    हफ्ता: "w",
    हफ्ते: "w",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    "साल",
    (counter) => (counter === 1 ? "महीना" : "महीने"),
    (counter) => (counter === 1 ? "हफ़्ता" : "हफ्ते"),
    "दिन",
    (counter) => (counter === 1 ? "घंटा" : "घंटे"),
    "मिनट",
    "सेकंड",
    "मिलीसेकंड",
    "%s में",
    "%s पहले",
    ".", // decimal
    hiUnitMap,
    ",", // groupSeparator
    "_", // placeholderSeparator
);
