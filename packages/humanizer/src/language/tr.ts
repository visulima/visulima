import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Turkish aliases to standard keys
const trUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ay: "mo",
    d: "m",
    dakika: "m",
    dk: "m",
    g: "d",
    gün: "d",
    h: "w",
    hafta: "w",
    milisaniye: "ms",
    ms: "ms",
    s: "h",
    sa: "h",
    saat: "h",
    saniye: "s",
    sn: "s",
    y: "y",
    yıl: "y",
} as const;

export const durationLanguage = createDurationLanguage(
    "yıl",
    "ay",
    "hafta",
    "gün",
    "saat",
    "dakika",
    "saniye",
    "milisaniye",
    "%s sonra",
    "%s önce",
    ",", // decimal
    trUnitMap,
    ".", // groupSeparator
    "_", // placeholderSeparator
);
