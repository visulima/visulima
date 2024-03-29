import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "سال",
    (counter) => (counter === 1 ? "مہینہ" : "مہینے"),
    (counter) => (counter === 1 ? "ہفتہ" : "ہفتے"),
    "دن",
    (counter) => (counter === 1 ? "گھنٹہ" : "گھنٹے"),
    "منٹ",
    "سیکنڈ",
    "ملی سیکنڈ",
    "%s بعد",
    "%s قبل",
);
