import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `Jahr${counter === 1 ? "" : "e"}`,
    (counter) => `Monat${counter === 1 ? "" : "e"}`,
    (counter) => `Woche${counter === 1 ? "" : "n"}`,
    (counter) => `Tag${counter === 1 ? "" : "e"}`,
    (counter) => `Stunde${counter === 1 ? "" : "n"}`,
    (counter) => `Minute${counter === 1 ? "" : "n"}`,
    (counter) => `Sekunde${counter === 1 ? "" : "n"}`,
    (counter) => `Millisekunde${counter === 1 ? "" : "n"}`,
    "in %s",
    "vor %s",
    ",",
);
