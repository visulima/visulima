import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => (c === 1 ? "vuosi" : "vuotta"),
    (c) => (c === 1 ? "kuukausi" : "kuukautta"),
    (c) => `viikko${c === 1 ? "" : "a"}`,
    (c) => `päivä${c === 1 ? "" : "ä"}`,
    (c) => `tunti${c === 1 ? "" : "a"}`,
    (c) => `minuutti${c === 1 ? "" : "a"}`,
    (c) => `sekunti${c === 1 ? "" : "a"}`,
    (c) => `millisekunti${c === 1 ? "" : "a"}`,
    "%s päästä",
    "%s sitten",
    ",",
);
