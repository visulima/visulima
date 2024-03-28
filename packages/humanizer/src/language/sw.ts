import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = {
    _numberFirst: true,
    ...createDurationLanguage(
        (counter) => (counter === 1 ? "mwaka" : "miaka"),
        (counter) => (counter === 1 ? "mwezi" : "miezi"),
        "wiki",
        (counter) => (counter === 1 ? "siku" : "masiku"),
        (counter) => (counter === 1 ? "saa" : "masaa"),
        "dakika",
        "sekunde",
        "milisekunde",
        "%s baadaye",
        "tokea %s",
    ),
};
