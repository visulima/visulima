import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Welsh aliases to standard keys
const cyUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "h",
    awr: "h",
    bl: "y",
    blwyddyn: "y",
    blynyddoedd: "y",
    d: "d",
    diwrnod: "d",
    dyddiau: "d",
    eil: "s",
    eiliad: "s",
    eiliadau: "s",
    m: "mo",
    milieiliad: "ms",
    milieiliadau: "ms",
    mis: "mo",
    misoedd: "mo",
    ms: "ms",
    mun: "m",
    munud: "m",
    munudau: "m",
    oriau: "h",
    s: "s", // Often used internationally
    w: "w",
    wythnos: "w",
    wythnosau: "w",
} as const;

// Welsh uses mutations, which makes simple pluralization tricky.
// These functions handle the most common cases for numbers.
const pluralize = (counter: number, singular: string, plural: string): string => (counter === 1 ? singular : plural);

export const durationLanguage = createDurationLanguage(
    (counter) => pluralize(counter, "flwyddyn", "blynedd"), // Mutation blwyddyn -> flwyddyn / blynedd
    "mis",
    "wythnos",
    "diwrnod",
    "awr",
    "munud",
    "eiliad",
    "milieiliad",
    "mewn %s",
    "%s yn ôl",
    ".", // decimal separator
    cyUnitMap,
    ",", // group separator
    "_", // placeholder separator
);

// Note: Full Welsh mutation support is complex and not implemented here.
