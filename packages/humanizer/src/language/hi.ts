import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "साल",
    (c) => (c === 1 ? "महीना" : "महीने"),
    (c) => (c === 1 ? "हफ़्ता" : "हफ्ते"),
    "दिन",
    (c) => (c === 1 ? "घंटा" : "घंटे"),
    "मिनट",
    "सेकंड",
    "मिलीसेकंड",
    "%s में",
    "%s पहले",
);
