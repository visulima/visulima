import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Catalan aliases to standard keys
const caUnitMap: Record<string, keyof DurationUnitMeasures> = {
    any: "y",
    anys: "y",
    dia: "d",
    dies: "d",
    hora: "h",
    hores: "h",
    mes: "mo",
    mesos: "mo",
    milisegon: "ms",
    milisegons: "ms",
    minut: "m",
    minuts: "m",
    segon: "s",
    segons: "s",
    setmana: "w",
    setmanes: "w",
};

export const durationLanguage = createDurationLanguage(
    (counter) => `any${counter === 1 ? "" : "s"}`,
    (counter) => `mes${counter === 1 ? "" : "os"}`,
    (counter) => `setman${counter === 1 ? "a" : "es"}`,
    (counter) => `di${counter === 1 ? "a" : "es"}`,
    (counter) => `hor${counter === 1 ? "a" : "es"}`,
    (counter) => `minut${counter === 1 ? "" : "s"}`,
    (counter) => `segon${counter === 1 ? "" : "s"}`,
    (counter) => `milisegon${counter === 1 ? "" : "s"}`,
    "d'aquí %s",
    "fa %s",
    ",", // decimal
    caUnitMap,
    ".", // groupSeparator
    "_", // placeholderSeparator
);
