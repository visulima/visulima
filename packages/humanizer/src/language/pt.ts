import type { DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Portuguese aliases to standard keys
const ptUnitMap: Record<string, keyof DurationUnitMeasures> = {
    a: "y",
    ano: "y",
    anos: "y",
    d: "d",
    dia: "d",
    dias: "d",
    h: "h",
    hora: "h",
    horas: "h",
    m: "mo",
    mês: "mo",
    meses: "mo",
    milissegundo: "ms",
    milissegundos: "ms",
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
    (counter) => `ano${counter === 1 ? "" : "s"}`,
    (counter) => (counter === 1 ? "mês" : "meses"),
    (counter) => `semana${counter === 1 ? "" : "s"}`,
    (counter) => `dia${counter === 1 ? "" : "s"}`,
    (counter) => `hora${counter === 1 ? "" : "s"}`,
    (counter) => `minuto${counter === 1 ? "" : "s"}`,
    (counter) => `segundo${counter === 1 ? "" : "s"}`,
    (counter) => `milissegundo${counter === 1 ? "" : "s"}`,
    "em %s",
    "há %s",
    ",", // decimal
    ptUnitMap,
    ".", // groupSeparator
    "_", // placeholderSeparator
);
