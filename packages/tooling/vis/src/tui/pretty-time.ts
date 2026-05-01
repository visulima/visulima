import type { DurationLanguage, DurationOptions } from "@visulima/humanizer";
import { duration } from "@visulima/humanizer";

const shortOptions: DurationOptions = {
    delimiter: " ",
    language: {
        d: () => " d",
        future: "in %s",
        h: () => " h",
        m: () => " m",
        mo: () => " mo",
        ms: () => " ms",
        past: "%s ago",
        s: () => " s",
        w: () => " w",
        y: () => " y",
    } satisfies DurationLanguage,
    largest: 2,
    round: true,
    spacer: "",
    units: ["h", "m", "s", "ms"],
};

/**
 * Formats a process.hrtime() tuple into a compact string like "1s 234ms".
 */
export const formatHrtime = (hrtime: [number, number]): string => {
    const ms = hrtime[0] * 1000 + hrtime[1] / 1_000_000;

    return duration(ms, shortOptions);
};

/**
 * Formats milliseconds into a compact string like "1s 300ms", "340ms", "1m 5s".
 */
export const formatMs = (ms: number): string => duration(ms, shortOptions);
