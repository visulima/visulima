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
    (c) => ["rok", "roku", "lata", "lat"][getPolishForm(c)],
    (c) => ["miesiąc", "miesiąca", "miesiące", "miesięcy"][getPolishForm(c)],
    (c) => ["tydzień", "tygodnia", "tygodnie", "tygodni"][getPolishForm(c)],
    (c) => ["dzień", "dnia", "dni", "dni"][getPolishForm(c)],
    (c) => ["godzina", "godziny", "godziny", "godzin"][getPolishForm(c)],
    (c) => ["minuta", "minuty", "minuty", "minut"][getPolishForm(c)],
    (c) => ["sekunda", "sekundy", "sekundy", "sekund"][getPolishForm(c)],
    (c) => ["milisekunda", "milisekundy", "milisekundy", "milisekund"][getPolishForm(c)],
    "za %s",
    "%s temu",
    ",",
);
