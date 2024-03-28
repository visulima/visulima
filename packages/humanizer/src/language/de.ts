import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => `Jahr${c === 1 ? "" : "e"}`,
    (c) => `Monat${c === 1 ? "" : "e"}`,
    (c) => `Woche${c === 1 ? "" : "n"}`,
    (c) => `Tag${c === 1 ? "" : "e"}`,
    (c) => `Stunde${c === 1 ? "" : "n"}`,
    (c) => `Minute${c === 1 ? "" : "n"}`,
    (c) => `Sekunde${c === 1 ? "" : "n"}`,
    (c) => `Millisekunde${c === 1 ? "" : "n"}`,
    "in %s",
    "vor %s",
    ",",
);
