import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Malay aliases to standard keys
const msUnitMap: Record<string, keyof DurationUnitMeasures> = {
    b: "mo",
    bln: "mo",
    bulan: "mo",
    h: "d",
    hari: "d",
    hr: "d",
    j: "h",
    jam: "h",
    m: "m",
    mg: "w",
    mgg: "w",
    milisaat: "ms",
    min: "m",
    minggu: "w",
    minit: "m",
    ms: "ms",
    msaat: "ms",
    s: "s",
    saat: "s",
    sat: "s",
    t: "y",
    tahun: "y",
    thn: "y",
} as const;

// Malay doesn't use plural forms for time units
export const durationLanguage = createDurationLanguage(
    "tahun",
    "bulan",
    "minggu",
    "hari",
    "jam",
    "minit",
    "saat",
    "milisaat",
    "dalam %s",
    "%s yang lepas", // "%s ago"
    ".", // decimal separator in Malay
    msUnitMap,
    ",", // group separator in Malay
    "_", // placeholder separator
);
