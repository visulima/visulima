import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

export const durationLanguage = createDurationLanguage(
    (counter) => ["godini", "godina", "godine"][getSlavicForm(counter)] as string,
    (counter) => ["meseci", "mesec", "meseca"][getSlavicForm(counter)] as string,
    (counter) => ["nedelji", "nedelja", "nedelje"][getSlavicForm(counter)] as string,
    (counter) => ["dani", "dan", "dana"][getSlavicForm(counter)] as string,
    (counter) => ["sati", "sat", "sata"][getSlavicForm(counter)] as string,
    (counter) => ["minuta", "minut", "minuta"][getSlavicForm(counter)] as string,
    (counter) => ["sekundi", "sekunda", "sekunde"][getSlavicForm(counter)] as string,
    (counter) => ["milisekundi", "milisekunda", "milisekunde"][getSlavicForm(counter)] as string,
    "za %s",
    "pre %s",
    ",",
    undefined,
    ".",
    "_",
);
