import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "χρόνος" : "χρόνια"),
    (counter) => (counter === 1 ? "μήνας" : "μήνες"),
    (counter) => (counter === 1 ? "εβδομάδα" : "εβδομάδες"),
    (counter) => (counter === 1 ? "μέρα" : "μέρες"),
    (counter) => (counter === 1 ? "ώρα" : "ώρες"),
    (counter) => (counter === 1 ? "λεπτό" : "λεπτά"),
    (counter) => (counter === 1 ? "δευτερόλεπτο" : "δευτερόλεπτα"),
    (counter) => `${counter === 1 ? "χιλιοστό" : "χιλιοστά"} του δευτερολέπτου`,
    "σε %s",
    "%s πριν",
    ",",
);
