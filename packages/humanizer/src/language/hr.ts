import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        if (c % 10 === 2 || c % 10 === 3 || c % 10 === 4) {
            return "godine";
        }
        return "godina";
    },
    function (c) {
        if (c === 1) {
            return "mjesec";
        } else if (c === 2 || c === 3 || c === 4) {
            return "mjeseca";
        }
        return "mjeseci";
    },
    function (c) {
        if (c % 10 === 1 && c !== 11) {
            return "tjedan";
        }
        return "tjedna";
    },
    function (c) {
        return c === 1 ? "dan" : "dana";
    },
    function (c) {
        if (c === 1) {
            return "sat";
        } else if (c === 2 || c === 3 || c === 4) {
            return "sata";
        }
        return "sati";
    },
    function (c) {
        var mod10 = c % 10;
        if ((mod10 === 2 || mod10 === 3 || mod10 === 4) && (c < 10 || c > 14)) {
            return "minute";
        }
        return "minuta";
    },
    function (c) {
        var mod10 = c % 10;
        if (mod10 === 5 || (Math.floor(c) === c && c >= 10 && c <= 19)) {
            return "sekundi";
        } else if (mod10 === 1) {
            return "sekunda";
        } else if (mod10 === 2 || mod10 === 3 || mod10 === 4) {
            return "sekunde";
        }
        return "sekundi";
    },
    function (c) {
        if (c === 1) {
            return "milisekunda";
        } else if (c % 10 === 2 || c % 10 === 3 || c % 10 === 4) {
            return "milisekunde";
        }
        return "milisekundi";
    },
    "za %s",
    "prije %s",
    ",",
);
