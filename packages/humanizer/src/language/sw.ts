import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = {
    _numberFirst: true,
    ...createDurationLanguage(
        (c) => (c === 1 ? "mwaka" : "miaka"),
        (c) => (c === 1 ? "mwezi" : "miezi"),
        "wiki",
        (c) => (c === 1 ? "siku" : "masiku"),
        (c) => (c === 1 ? "saa" : "masaa"),
        "dakika",
        "sekunde",
        "milisekunde",
        "%s baadaye",
        "tokea %s",
    ),
};
