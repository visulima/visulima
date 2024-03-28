import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = {
    _numberFirst: true,
    ...createDurationLanguage(
        function (c) {
            return c === 1 ? "mwaka" : "miaka";
        },
        function (c) {
            return c === 1 ? "mwezi" : "miezi";
        },
        "wiki",
        function (c) {
            return c === 1 ? "siku" : "masiku";
        },
        function (c) {
            return c === 1 ? "saa" : "masaa";
        },
        "dakika",
        "sekunde",
        "milisekunde",
        "%s baadaye",
        "tokea %s",
    ),
};
