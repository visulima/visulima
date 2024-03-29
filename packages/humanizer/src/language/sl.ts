import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => {
        if (counter % 10 === 1) {
            return "leto";
        }

        if (counter % 100 === 2) {
            return "leti";
        }

        if (counter % 100 === 3 || counter % 100 === 4 || (Math.floor(counter) !== counter && counter % 100 <= 5)) {
            return "leta";
        }

        return "let";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "mesec";
        }

        if (counter % 100 === 2 || (Math.floor(counter) !== counter && counter % 100 <= 5)) {
            return "meseca";
        }

        if (counter % 10 === 3 || counter % 10 === 4) {
            return "mesece";
        }

        return "mesecev";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "teden";
        }

        if (counter % 10 === 2 || (Math.floor(counter) !== counter && counter % 100 <= 4)) {
            return "tedna";
        }

        if (counter % 10 === 3 || counter % 10 === 4) {
            return "tedne";
        }

        return "tednov";
    },
    (counter) => (counter % 100 === 1 ? "dan" : "dni"),
    (counter) => {
        if (counter % 10 === 1) {
            return "ura";
        }

        if (counter % 100 === 2) {
            return "uri";
        }

        if (counter % 10 === 3 || counter % 10 === 4 || Math.floor(counter) !== counter) {
            return "ure";
        }

        return "ur";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "minuta";
        }

        if (counter % 10 === 2) {
            return "minuti";
        }

        if (counter % 10 === 3 || counter % 10 === 4 || (Math.floor(counter) !== counter && counter % 100 <= 4)) {
            return "minute";
        }

        return "minut";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "sekunda";
        }

        if (counter % 100 === 2) {
            return "sekundi";
        }

        if (counter % 100 === 3 || counter % 100 === 4 || Math.floor(counter) !== counter) {
            return "sekunde";
        }

        return "sekund";
    },
    (counter) => {
        if (counter % 10 === 1) {
            return "milisekunda";
        }

        if (counter % 100 === 2) {
            return "milisekundi";
        }

        if (counter % 100 === 3 || counter % 100 === 4 || Math.floor(counter) !== counter) {
            return "milisekunde";
        }

        return "milisekund";
    },
    "čez %s",
    "pred %s",
    ",",
);
