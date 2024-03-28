import createDurationLanguage from "./util/create-duration-language";

const getLithuanianForm = (counter: number): number => {
    if (counter === 1 || (counter % 10 === 1 && counter % 100 > 20)) {
        return 0;
    }

    if (Math.floor(counter) !== c || (counter % 10 >= 2 && c % 100 > 20) || (counter % 10 >= 2 && c % 100 < 10)) {
        return 1;
    }

    return 2;
};

export const durationLanguage = createDurationLanguage(
    (c) => (c % 10 === 0 || (c % 100 >= 10 && c % 100 <= 20) ? "metų" : "metai"),
    (c) => ["mėnuo", "mėnesiai", "mėnesių"][getLithuanianForm(c)],
    (c) => ["savaitė", "savaitės", "savaičių"][getLithuanianForm(c)],
    (c) => ["diena", "dienos", "dienų"][getLithuanianForm(c)],
    (c) => ["valanda", "valandos", "valandų"][getLithuanianForm(c)],
    (c) => ["minutė", "minutės", "minučių"][getLithuanianForm(c)],
    (c) => ["sekundė", "sekundės", "sekundžių"][getLithuanianForm(c)],
    (c) => ["milisekundė", "milisekundės", "milisekundžių"][getLithuanianForm(c)],
    "po %s",
    "prieš %s",
    ",",
);
