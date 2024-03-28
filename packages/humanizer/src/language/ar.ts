import createDurationLanguage from "./util/create-duration-language";

const getArabicForm = (counter: number): number => {
    if (counter === 2) {
        return 1;
    }

    if (counter > 2 && c < 11) {
        return 2;
    }

    return 0;
};

export const durationLanguage = createDurationLanguage(
    (counter) => ["سنة", "سنتان", "سنوات"][getArabicForm(counter)],
    (counter) => ["شهر", "شهران", "أشهر"][getArabicForm(counter)],
    (counter) => ["أسبوع", "أسبوعين", "أسابيع"][getArabicForm(counter)],
    (counter) => ["يوم", "يومين", "أيام"][getArabicForm(counter)],
    (counter) => ["ساعة", "ساعتين", "ساعات"][getArabicForm(counter)],
    (counter) => ["دقيقة", "دقيقتان", "دقائق"][getArabicForm(counter)],
    (counter) => ["ثانية", "ثانيتان", "ثواني"][getArabicForm(counter)],
    (counter) => ["جزء من الثانية", "جزآن من الثانية", "أجزاء من الثانية"][getArabicForm(counter)],
    "بعد %s",
    "منذ %s",
    ",",
);
