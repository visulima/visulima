import createDurationLanguage from "./util/create-duration-language";

const getArabicForm = (counter: number): number => {
    if (counter === 2) {
        return 1;
    }

    if (counter > 2 && counter < 11) {
        return 2;
    }

    return 0;
};

export const durationLanguage = createDurationLanguage(
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
    ",",
);
