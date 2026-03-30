import { getStringWidth } from "@visulima/string";

import DataLimitedLruMap from "./data-limited-lru-map";

export type StringWidthFunction = (text: string) => number;

type Output = {
    height: number;
    width: number;
};

// Use LRU cache with bounded size to prevent unbounded memory growth
// in long-running applications. Limits: 10,000 entries, 1MB of key data.
const cache = new DataLimitedLruMap<Output>(10_000, 1_000_000);

let currentStringWidth: StringWidthFunction = getStringWidth;

/**
 * Replace the string width function used for text measurement.
 * Useful for terminals with non-standard character widths.
 * Clears the measurement cache when called.
 */
export const setStringWidthFunction = (fn: StringWidthFunction): void => {
    currentStringWidth = fn;
    clearStringWidthCache();
};

/**
 * Clear the string width measurement cache. Call this if the terminal
 * environment changes in a way that affects character widths.
 */
export const clearStringWidthCache = (): void => {
    cache.clear();
};

/**
 * Get the visual width of a string, with error handling for invalid characters.
 */
const safeGetStringWidth = (text: string): number => {
    try {
        return currentStringWidth(text);
    } catch {
        // Avoid crashing on invalid characters (e.g. lone surrogates).
        // Return 1 as a safe default width.
        return 1;
    }
};

const measureText = (text: string): Output => {
    if (text.length === 0) {
        return {
            height: 0,
            width: 0,
        };
    }

    const cachedDimensions = cache.get(text);

    if (cachedDimensions) {
        return cachedDimensions;
    }

    const lines = text.split("\n");
    const width = Math.max(...lines.map((line) => safeGetStringWidth(line)));
    const height = lines.length;
    const dimensions = { height, width };

    cache.set(text, dimensions);

    return dimensions;
};

export default measureText;
