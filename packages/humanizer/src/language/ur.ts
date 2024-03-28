import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "سال",
    (c) => (c === 1 ? "مہینہ" : "مہینے"),
    (c) => (c === 1 ? "ہفتہ" : "ہفتے"),
    "دن",
    (c) => (c === 1 ? "گھنٹہ" : "گھنٹے"),
    "منٹ",
    "سیکنڈ",
    "ملی سیکنڈ",
    "%s بعد",
    "%s قبل",
);
