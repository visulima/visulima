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
    function (c) {
        return c % 10 === 0 || (c % 100 >= 10 && c % 100 <= 20) ? "metų" : "metai";
    },
    function (c) {
        return ["mėnuo", "mėnesiai", "mėnesių"][getLithuanianForm(c)];
    },
    function (c) {
        return ["savaitė", "savaitės", "savaičių"][getLithuanianForm(c)];
    },
    function (c) {
        return ["diena", "dienos", "dienų"][getLithuanianForm(c)];
    },
    function (c) {
        return ["valanda", "valandos", "valandų"][getLithuanianForm(c)];
    },
    function (c) {
        return ["minutė", "minutės", "minučių"][getLithuanianForm(c)];
    },
    function (c) {
        return ["sekundė", "sekundės", "sekundžių"][getLithuanianForm(c)];
    },
    function (c) {
        return ["milisekundė", "milisekundės", "milisekundžių"][getLithuanianForm(c)];
    },
    "po %s",
    "prieš %s",
    ",",
);
