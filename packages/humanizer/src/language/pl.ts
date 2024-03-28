import createDurationLanguage from "./util/create-duration-language";

const getPolishForm = (counter: number): number => {
    if (counter === 1) {
        return 0;
    }

    if (Math.floor(counter) !== counter) {
        return 1;
    }

    if (counter % 10 >= 2 && counter % 10 <= 4 && !(counter % 100 > 10 && counter % 100 < 20)) {
        return 2;
    }

    return 3;
};

export const durationLanguage = createDurationLanguage(
    function (c) {
        return ["rok", "roku", "lata", "lat"][getPolishForm(c)];
    },
    function (c) {
        return ["miesiąc", "miesiąca", "miesiące", "miesięcy"][getPolishForm(c)];
    },
    function (c) {
        return ["tydzień", "tygodnia", "tygodnie", "tygodni"][getPolishForm(c)];
    },
    function (c) {
        return ["dzień", "dnia", "dni", "dni"][getPolishForm(c)];
    },
    function (c) {
        return ["godzina", "godziny", "godziny", "godzin"][getPolishForm(c)];
    },
    function (c) {
        return ["minuta", "minuty", "minuty", "minut"][getPolishForm(c)];
    },
    function (c) {
        return ["sekunda", "sekundy", "sekundy", "sekund"][getPolishForm(c)];
    },
    function (c) {
        return ["milisekunda", "milisekundy", "milisekundy", "milisekund"][getPolishForm(c)];
    },
    "za %s",
    "%s temu",
    ",",
);
