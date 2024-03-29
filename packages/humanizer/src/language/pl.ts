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
    (counter) => ["rok", "roku", "lata", "lat"][getPolishForm(counter)] as string,
    (counter) => ["miesiąc", "miesiąca", "miesiące", "miesięcy"][getPolishForm(counter)] as string,
    (counter) => ["tydzień", "tygodnia", "tygodnie", "tygodni"][getPolishForm(counter)] as string,
    (counter) => ["dzień", "dnia", "dni", "dni"][getPolishForm(counter)] as string,
    (counter) => ["godzina", "godziny", "godziny", "godzin"][getPolishForm(counter)] as string,
    (counter) => ["minuta", "minuty", "minuty", "minut"][getPolishForm(counter)] as string,
    (counter) => ["sekunda", "sekundy", "sekundy", "sekund"][getPolishForm(counter)] as string,
    (counter) => ["milisekunda", "milisekundy", "milisekundy", "milisekund"][getPolishForm(counter)] as string,
    "za %s",
    "%s temu",
    ",",
);
