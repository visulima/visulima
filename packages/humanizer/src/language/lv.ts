import createDurationLanguage from "./util/create-duration-language";

const getLatvianForm = (counter: number) => {
    return counter % 10 === 1 && counter % 100 !== 11;
};

export const durationLanguage = createDurationLanguage(
    function (c) {
        return getLatvianForm(c) ? "gads" : "gadi";
    },
    function (c) {
        return getLatvianForm(c) ? "mēnesis" : "mēneši";
    },
    function (c) {
        return getLatvianForm(c) ? "nedēļa" : "nedēļas";
    },
    function (c) {
        return getLatvianForm(c) ? "diena" : "dienas";
    },
    function (c) {
        return getLatvianForm(c) ? "stunda" : "stundas";
    },
    function (c) {
        return getLatvianForm(c) ? "minūte" : "minūtes";
    },
    function (c) {
        return getLatvianForm(c) ? "sekunde" : "sekundes";
    },
    function (c) {
        return getLatvianForm(c) ? "milisekunde" : "milisekundes";
    },
    "pēc %s",
    "pirms %s",
    ",",
);
