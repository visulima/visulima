import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "سال",
    function (c) {
        return c === 1 ? "مہینہ" : "مہینے";
    },
    function (c) {
        return c === 1 ? "ہفتہ" : "ہفتے";
    },
    "دن",
    function (c) {
        return c === 1 ? "گھنٹہ" : "گھنٹے";
    },
    "منٹ",
    "سیکنڈ",
    "ملی سیکنڈ",
    "%s بعد",
    "%s قبل",
);
