import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Finnish aliases to standard keys
const fiUnitMap: Record<string, keyof DurationUnitMeasures> = {
    k: "mo",
    kk: "mo",
    kuukausi: "mo",
    kuukautta: "mo",
    millisekunti: "ms",
    millisekuntia: "ms",
    min: "m",
    minuutti: "m",
    minuuttia: "m",
    ms: "ms",
    p: "d",
    päivä: "d",
    päivää: "d",
    pv: "d",
    s: "s",
    sek: "s",
    sekunti: "s",
    sekuntia: "s",
    t: "h",
    tunti: "h",
    tuntia: "h",
    v: "y",
    viikko: "w",
    viikkoa: "w",
    vk: "w",
    vko: "w",
    vuosi: "y",
    vuotta: "y",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "vuosi" : "vuotta"),
    (counter) => (counter === 1 ? "kuukausi" : "kuukautta"),
    (counter) => `viikko${counter === 1 ? "" : "a"}`,
    (counter) => `päivä${counter === 1 ? "" : "ä"}`,
    (counter) => `tunti${counter === 1 ? "" : "a"}`,
    (counter) => `minuutti${counter === 1 ? "" : "a"}`,
    (counter) => `sekunti${counter === 1 ? "" : "a"}`,
    (counter) => `millisekunti${counter === 1 ? "" : "a"}`,
    "%s päästä", // "in %s"
    "%s sitten", // "%s ago"
    ",", // decimal separator in Finnish
    fiUnitMap,
    " ", // group separator in Finnish
    "_", // placeholder separator
);
