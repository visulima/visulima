import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Kannada aliases to standard keys
const knUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ms: "ms",
    ಗಂ: "h",
    ಗಂಟೆ: "h",
    ಗಂಟೆಗಳು: "h",
    ತಿಂ: "mo",
    ತಿಂಗಳು: "mo",
    ತಿಂಗಳುಗಳು: "mo",
    ದಿ: "d",
    ದಿನ: "d",
    ದಿನಗಳು: "d",
    ನಿ: "m",
    ನಿಮಿಷ: "m",
    ನಿಮಿಷಗಳು: "m",
    ಮಿಲಿಸೆಕೆಂಡುಗಳು: "ms",
    ಮಿಲಿಸೆಕೆಂಡ್: "ms",
    ಮಿಸೆ: "ms",
    ವ: "y",
    ವರ್ಷ: "y",
    ವರ್ಷಗಳು: "y",
    ವಾ: "w",
    ವಾರ: "w",
    ವಾರಗಳು: "w",
    ಸೆ: "s",
    ಸೆಕೆಂಡುಗಳು: "s",
    ಸೆಕೆಂಡ್: "s",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "ವರ್ಷ" : "ವರ್ಷಗಳು"),
    (counter) => (counter === 1 ? "ತಿಂಗಳು" : "ತಿಂಗಳುಗಳು"),
    (counter) => (counter === 1 ? "ವಾರ" : "ವಾರಗಳು"),
    (counter) => (counter === 1 ? "ದಿನ" : "ದಿನಗಳು"),
    (counter) => (counter === 1 ? "ಗಂಟೆ" : "ಗಂಟೆಗಳು"),
    (counter) => (counter === 1 ? "ನಿಮಿಷ" : "ನಿಮಿಷಗಳು"),
    (counter) => (counter === 1 ? "ಸೆಕೆಂಡ್" : "ಸೆಕೆಂಡುಗಳು"),
    (counter) => (counter === 1 ? "ಮಿಲಿಸೆಕೆಂಡ್" : "ಮಿಲಿಸೆಕೆಂಡುಗಳು"),
    "%s ನಂತರ",
    "%s ಹಿಂದೆ",
    ".", // decimal separator
    knUnitMap,
    ",", // group separator
    "_", // placeholder separator
);
