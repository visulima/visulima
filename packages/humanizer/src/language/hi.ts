import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "साल",
    function (c) {
        return c === 1 ? "महीना" : "महीने";
    },
    function (c) {
        return c === 1 ? "हफ़्ता" : "हफ्ते";
    },
    "दिन",
    function (c) {
        return c === 1 ? "घंटा" : "घंटे";
    },
    "मिनट",
    "सेकंड",
    "मिलीसेकंड",
    "%s में",
    "%s पहले",
);
