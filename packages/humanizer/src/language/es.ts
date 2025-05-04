import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Spanish aliases to standard keys
const esUnitMap: Record<string, keyof DurationUnitMeasures> = {
    año: "y",
    años: "y",
    d: "d",
    día: "d",
    días: "d",
    h: "h",
    hora: "h",
    horas: "h",
    mes: "mo",
    meses: "mo",
    milisegundo: "ms",
    milisegundos: "ms",
    min: "m",
    minuto: "m",
    minutos: "m",
    ms: "ms",
    s: "s",
    seg: "s",
    segundo: "s",
    segundos: "s",
    sem: "w",
    semana: "w",
    semanas: "w",
} as const;

export const durationLanguage = createDurationLanguage(
    (counter) => `año${counter === 1 ? "" : "s"}`,
    (counter) => `mes${counter === 1 ? "" : "es"}`,
    (counter) => `semana${counter === 1 ? "" : "s"}`,
    (counter) => `día${counter === 1 ? "" : "s"}`,
    (counter) => `hora${counter === 1 ? "" : "s"}`,
    (counter) => `minuto${counter === 1 ? "" : "s"}`,
    (counter) => `segundo${counter === 1 ? "" : "s"}`,
    (counter) => `milisegundo${counter === 1 ? "" : "s"}`,
    "en %s",
    "hace %s",
    ",",
    esUnitMap,
    ".", // Spanish uses . for groups, , for decimal
    "_",
);
