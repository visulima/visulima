import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";
import getSlavicForm from "./util/duration/get-slavic-form";

// Map Serbian-Latin aliases to standard keys so parseDuration can round-trip the
// strings produced by duration() with this language (every other locale ships a
// unitMap; sr_Latn had drifted to `undefined` and silently parsed English only).
const srLatnUnitMap: Record<string, keyof DurationUnitMeasures> = {
    dan: "d",
    dana: "d",
    godina: "y",
    godine: "y",
    godinu: "y",
    mesec: "mo",
    meseca: "mo",
    meseci: "mo",
    milisekunda: "ms",
    milisekunde: "ms",
    milisekundi: "ms",
    minut: "m",
    minuta: "m",
    ms: "ms",
    nedelja: "w",
    nedelje: "w",
    nedelju: "w",
    sat: "h",
    sata: "h",
    sati: "h",
    sekunda: "s",
    sekunde: "s",
    sekundi: "s",
};

export const durationLanguage: DurationLanguage = createDurationLanguage(
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
    srLatnUnitMap,
    ".",
    "_",
);
