import type { DurationUnitMeasures, DurationLanguage } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Albanian aliases to standard keys
const sqUnitMap: Record<string, keyof DurationUnitMeasures> = {
    d: "d",
    dita: "d",
    ditë: "d",
    j: "w",
    java: "w",
    javë: "w",
    m: "mo",
    milisekonda: "ms",
    milisekondë: "ms",
    min: "m",
    minuta: "m",
    minutë: "m",
    ms: "ms",
    muaj: "mo",
    o: "h",
    ora: "h",
    orë: "h",
    s: "s",
    sek: "s",
    sekonda: "s",
    sekondë: "s",
    v: "y",
    vit: "y",
    vite: "y",
    vitet: "y", // definite plural
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "vit" : "vjet"),
    "muaj",
    "javë",
    "ditë",
    "orë",
    (counter) => `minut${counter === 1 ? "ë" : "a"}`,
    (counter) => `sekond${counter === 1 ? "ë" : "a"}`,
    (counter) => `milisekond${counter === 1 ? "ë" : "a"}`,
    "në %s",
    "%s më parë",
    ",", // decimal
    sqUnitMap,
    ".", // groupSeparator
    "_", // placeholderSeparator
);
