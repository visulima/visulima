import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => {
        if (c % 10 === 2 || c % 10 === 3 || c % 10 === 4) {
            return "godine";
        }
        return "godina";
    },
    (c) => {
        if (c === 1) {
            return "mjesec";
        } if (c === 2 || c === 3 || c === 4) {
            return "mjeseca";
        }
        return "mjeseci";
    },
    (c) => {
        if (c % 10 === 1 && c !== 11) {
            return "tjedan";
        }
        return "tjedna";
    },
    (c) => (c === 1 ? "dan" : "dana"),
    (c) => {
        if (c === 1) {
            return "sat";
        } if (c === 2 || c === 3 || c === 4) {
            return "sata";
        }
        return "sati";
    },
    (c) => {
        const module10 = c % 10;
        if ((module10 === 2 || module10 === 3 || module10 === 4) && (c < 10 || c > 14)) {
            return "minute";
        }
        return "minuta";
    },
    (c) => {
        const module10 = c % 10;
        if (module10 === 5 || (Math.floor(c) === c && c >= 10 && c <= 19)) {
            return "sekundi";
        } if (module10 === 1) {
            return "sekunda";
        } if (module10 === 2 || module10 === 3 || module10 === 4) {
            return "sekunde";
        }
        return "sekundi";
    },
    (c) => {
        if (c === 1) {
            return "milisekunda";
        } if (c % 10 === 2 || c % 10 === 3 || c % 10 === 4) {
            return "milisekunde";
        }
        return "milisekundi";
    },
    "za %s",
    "prije %s",
    ",",
);
