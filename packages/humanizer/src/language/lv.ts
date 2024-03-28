import createDurationLanguage from "./util/create-duration-language";

const getLatvianForm = (counter: number) => counter % 10 === 1 && counter % 100 !== 11;

export const durationLanguage = createDurationLanguage(
    (counter) => (getLatvianForm(counter) ? "gads" : "gadi"),
    (counter) => (getLatvianForm(counter) ? "mēnesis" : "mēneši"),
    (counter) => (getLatvianForm(counter) ? "nedēļa" : "nedēļas"),
    (counter) => (getLatvianForm(counter) ? "diena" : "dienas"),
    (counter) => (getLatvianForm(counter) ? "stunda" : "stundas"),
    (counter) => (getLatvianForm(counter) ? "minūte" : "minūtes"),
    (counter) => (getLatvianForm(counter) ? "sekunde" : "sekundes"),
    (counter) => (getLatvianForm(counter) ? "milisekunde" : "milisekundes"),
    "pēc %s",
    "pirms %s",
    ",",
);
