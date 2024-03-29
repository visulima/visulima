import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "vuosi" : "vuotta"),
    (counter) => (counter === 1 ? "kuukausi" : "kuukautta"),
    (counter) => `viikko${counter === 1 ? "" : "a"}`,
    (counter) => `päivä${counter === 1 ? "" : "ä"}`,
    (counter) => `tunti${counter === 1 ? "" : "a"}`,
    (counter) => `minuutti${counter === 1 ? "" : "a"}`,
    (counter) => `sekunti${counter === 1 ? "" : "a"}`,
    (counter) => `millisekunti${counter === 1 ? "" : "a"}`,
    "%s päästä",
    "%s sitten",
    ",",
);
