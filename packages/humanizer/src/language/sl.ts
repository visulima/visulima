import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        if (c % 10 === 1) {
            return "leto";
        } else if (c % 100 === 2) {
            return "leti";
        } else if (c % 100 === 3 || c % 100 === 4 || (Math.floor(c) !== c && c % 100 <= 5)) {
            return "leta";
        } else {
            return "let";
        }
    },
    function (c) {
        if (c % 10 === 1) {
            return "mesec";
        } else if (c % 100 === 2 || (Math.floor(c) !== c && c % 100 <= 5)) {
            return "meseca";
        } else if (c % 10 === 3 || c % 10 === 4) {
            return "mesece";
        } else {
            return "mesecev";
        }
    },
    function (c) {
        if (c % 10 === 1) {
            return "teden";
        } else if (c % 10 === 2 || (Math.floor(c) !== c && c % 100 <= 4)) {
            return "tedna";
        } else if (c % 10 === 3 || c % 10 === 4) {
            return "tedne";
        } else {
            return "tednov";
        }
    },
    function (c) {
        return c % 100 === 1 ? "dan" : "dni";
    },
    function (c) {
        if (c % 10 === 1) {
            return "ura";
        } else if (c % 100 === 2) {
            return "uri";
        } else if (c % 10 === 3 || c % 10 === 4 || Math.floor(c) !== c) {
            return "ure";
        } else {
            return "ur";
        }
    },
    function (c) {
        if (c % 10 === 1) {
            return "minuta";
        } else if (c % 10 === 2) {
            return "minuti";
        } else if (c % 10 === 3 || c % 10 === 4 || (Math.floor(c) !== c && c % 100 <= 4)) {
            return "minute";
        } else {
            return "minut";
        }
    },
    function (c) {
        if (c % 10 === 1) {
            return "sekunda";
        } else if (c % 100 === 2) {
            return "sekundi";
        } else if (c % 100 === 3 || c % 100 === 4 || Math.floor(c) !== c) {
            return "sekunde";
        } else {
            return "sekund";
        }
    },
    function (c) {
        if (c % 10 === 1) {
            return "milisekunda";
        } else if (c % 100 === 2) {
            return "milisekundi";
        } else if (c % 100 === 3 || c % 100 === 4 || Math.floor(c) !== c) {
            return "milisekunde";
        } else {
            return "milisekund";
        }
    },
    "čez %s",
    "pred %s",
    ",",
);
