import createDurationLanguage from "./util/create-duration-language";

const getLithuanianForm = (counter: number): number => {
    if (counter === 1 || (counter % 10 === 1 && counter % 100 > 20)) {
        return 0;
    }

    if (Math.floor(counter) !== counter || (counter % 10 >= 2 && counter % 100 > 20) || (counter % 10 >= 2 && counter % 100 < 10)) {
        return 1;
    }

    return 2;
};

export const durationLanguage = createDurationLanguage(
    (counter) => (counter % 10 === 0 || (counter % 100 >= 10 && counter % 100 <= 20) ? "metų" : "metai"),
    (counter) => ["mėnuo", "mėnesiai", "mėnesių"][getLithuanianForm(counter)] as string,
    (counter) => ["savaitė", "savaitės", "savaičių"][getLithuanianForm(counter)] as string,
    (counter) => ["diena", "dienos", "dienų"][getLithuanianForm(counter)] as string,
    (counter) => ["valanda", "valandos", "valandų"][getLithuanianForm(counter)] as string,
    (counter) => ["minutė", "minutės", "minučių"][getLithuanianForm(counter)] as string,
    (counter) => ["sekundė", "sekundės", "sekundžių"][getLithuanianForm(counter)] as string,
    (counter) => ["milisekundė", "milisekundės", "milisekundžių"][getLithuanianForm(counter)] as string,
    "po %s",
    "prieš %s",
    ",",
);
