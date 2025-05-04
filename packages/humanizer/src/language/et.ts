import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Estonian aliases to standard keys
const etUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "y",
    aasta: "y",
    aastat: "y",
    k: "mo",
    kuu: "mo",
    kuud: "mo",
    millisekund: "ms",
    millisekundit: "ms",
    min: "m",
    minut: "m",
    minutit: "m",
    ms: "ms",
    näd: "w",
    nädal: "w",
    nädalat: "w",
    p: "d",
    päev: "d",
    päeva: "d",
    s: "s",
    sek: "s",
    sekund: "s",
    sekundit: "s",
    t: "h",
    tund: "h",
    tundi: "h",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => `aasta${counter === 1 ? "" : "t"}`,
    (counter) => `kuu${counter === 1 ? "" : "d"}`,
    (counter) => `nädal${counter === 1 ? "" : "at"}`,
    (counter) => `päev${counter === 1 ? "" : "a"}`,
    (counter) => `tund${counter === 1 ? "" : "i"}`,
    (counter) => `minut${counter === 1 ? "" : "it"}`,
    (counter) => `sekund${counter === 1 ? "" : "it"}`,
    (counter) => `millisekund${counter === 1 ? "" : "it"}`,
    "%s pärast",
    "%s tagasi",
    ",",
    etUnitMap,
    " ",
    "_",
);
