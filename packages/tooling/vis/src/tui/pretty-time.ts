import { duration } from "@visulima/humanizer";

/**
 * Formats a process.hrtime() tuple into a human-readable string.
 * @param hrtime - [seconds, nanoseconds] tuple from process.hrtime()
 * @returns Formatted string like "1s 234ms"
 */
export const formatHrtime = (hrtime: [number, number]): string => {
    const ms = hrtime[0] * 1000 + hrtime[1] / 1_000_000;

    return duration(ms, {
        largest: 2,
        units: ["h", "m", "s", "ms"],
    });
};

/**
 * Formats milliseconds into a compact human-readable string.
 */
export const formatMs = (ms: number): string => {
    return duration(ms, {
        largest: 2,
        units: ["h", "m", "s", "ms"],
    });
};
