import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Arabic aliases to standard keys
const arUnitMap: Record<string, keyof DurationUnitMeasures> = {
    "أجزاء من الثانية": "ms",
    أسابيع: "w",
    أسبوع: "w",
    "أشهر طويلة": "mo",
    أعوام: "y",
    أيام: "d",
    ثانية: "s",
    ثواني: "s",
    "جزء من الثانية": "ms",
    دقائق: "m",
    دقيقة: "m",
    ساعات: "h",
    ساعة: "h",
    "شهر طويل": "mo",
    عام: "y",
    يوم: "d",
};

const getArabicForm = (counter: number): number => {
    if (counter === 2) {
        return 1;
    }

    if (counter > 2 && counter < 11) {
        return 2;
    }

    return 0;
};

export const durationLanguage: DurationLanguage = {
    ...createDurationLanguage(
        (counter) => ["سنة", "سنتان", "سنوات"][getArabicForm(counter)] as string,
        (counter) => ["شهر", "شهران", "أشهر"][getArabicForm(counter)] as string,
        (counter) => ["أسبوع", "أسبوعين", "أسابيع"][getArabicForm(counter)] as string,
        (counter) => ["يوم", "يومين", "أيام"][getArabicForm(counter)] as string,
        (counter) => ["ساعة", "ساعتين", "ساعات"][getArabicForm(counter)] as string,
        (counter) => ["دقيقة", "دقيقتان", "دقائق"][getArabicForm(counter)] as string,
        (counter) => ["ثانية", "ثانيتان", "ثواني"][getArabicForm(counter)] as string,
        (counter) => ["جزء من الثانية", "جزآن من الثانية", "أجزاء من الثانية"][getArabicForm(counter)] as string,
        "بعد %s",
        "منذ %s",
        " ﻭ ",
        arUnitMap,
        "٬", // groupSeparator - Arabic uses U+066C
        "_", // placeholderSeparator
    ),
    _digitReplacements: ["۰", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"],
    _hideCountIf2: true,
};
