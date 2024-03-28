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
    function (counter) {
        return ["سنة", "سنتان", "سنوات"][getArabicForm(counter)];
    },
    function (counter) {
        return ["شهر", "شهران", "أشهر"][getArabicForm(counter)];
    },
    function (counter) {
        return ["أسبوع", "أسبوعين", "أسابيع"][getArabicForm(counter)];
    },
    function (counter) {
        return ["يوم", "يومين", "أيام"][getArabicForm(counter)];
    },
    function (counter) {
        return ["ساعة", "ساعتين", "ساعات"][getArabicForm(counter)];
    },
    function (counter) {
        return ["دقيقة", "دقيقتان", "دقائق"][getArabicForm(counter)];
    },
    function (counter) {
        return ["ثانية", "ثانيتان", "ثواني"][getArabicForm(counter)];
    },
    function (counter) {
        return ["جزء من الثانية", "جزآن من الثانية", "أجزاء من الثانية"][getArabicForm(counter)];
    },
    "بعد %s",
    "منذ %s",
    ",",
);
