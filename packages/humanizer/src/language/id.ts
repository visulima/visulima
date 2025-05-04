import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Indonesian aliases to standard keys
const idUnitMap: Record<string, keyof DurationUnitMeasures> = {
    bl: "mo",
    bln: "mo",
    bulan: "mo",
    detik: "s",
    dt: "s",
    dtk: "s",
    hari: "d",
    hr: "d",
    j: "h",
    jam: "h",
    md: "ms",
    menit: "m",
    mg: "w",
    mgg: "w",
    milidetik: "ms",
    minggu: "w",
    mn: "m",
    mnt: "m",
    ms: "ms",
    tahun: "y",
    th: "y",
    thn: "y",
} as const;

export const durationLanguage = createDurationLanguage(
    "tahun", // Indonesian doesn't use plural forms for time units
    "bulan",
    "minggu",
    "hari",
    "jam",
    "menit",
    "detik",
    "milidetik",
    "dalam %s", // "in %s"
    "%s yang lalu", // "%s ago"
    ",", // decimal separator
    idUnitMap,
    ".", // group separator in Indonesian
    "_", // placeholder separator
);
