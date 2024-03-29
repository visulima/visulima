import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "साल",
    (counter) => (counter === 1 ? "महीना" : "महीने"),
    (counter) => (counter === 1 ? "हफ़्ता" : "हफ्ते"),
    "दिन",
    (counter) => (counter === 1 ? "घंटा" : "घंटे"),
    "मिनट",
    "सेकंड",
    "मिलीसेकंड",
    "%s में",
    "%s पहले",
);
