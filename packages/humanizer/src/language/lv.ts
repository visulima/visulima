import createDurationLanguage from "./util/create-duration-language";

const getLatvianForm = (counter: number) => counter % 10 === 1 && counter % 100 !== 11;

export const durationLanguage = createDurationLanguage(
    (c) => (getLatvianForm(c) ? "gads" : "gadi"),
    (c) => (getLatvianForm(c) ? "mēnesis" : "mēneši"),
    (c) => (getLatvianForm(c) ? "nedēļa" : "nedēļas"),
    (c) => (getLatvianForm(c) ? "diena" : "dienas"),
    (c) => (getLatvianForm(c) ? "stunda" : "stundas"),
    (c) => (getLatvianForm(c) ? "minūte" : "minūtes"),
    (c) => (getLatvianForm(c) ? "sekunde" : "sekundes"),
    (c) => (getLatvianForm(c) ? "milisekunde" : "milisekundes"),
    "pēc %s",
    "pirms %s",
    ",",
);
