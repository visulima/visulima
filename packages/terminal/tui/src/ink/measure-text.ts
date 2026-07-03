/* eslint-disable @typescript-eslint/no-use-before-define */
import { getStringWidth } from "@visulima/string";

import DataLimitedLruMap from "./data-limited-lru-map";
import { StyledLine } from "./styled-line";
import { textToStyledLine } from "./styled-line-factory";

export type StringWidthFunction = (text: string) => number;

type Output = {
    height: number;
    width: number;
};

// Use LRU cache with bounded size to prevent unbounded memory growth
// in long-running applications. Limits: 10,000 entries, 1MB of key data.
const cache = new DataLimitedLruMap<Output>(10_000, 1_000_000);

// Cache for character width lookups. Keyed on grapheme cluster values which can
// be multi-codepoint (combining marks, ZWJ emoji, regional indicators) and are
// therefore effectively unbounded — use an LRU to prevent memory growth.
const widthCache = new DataLimitedLruMap<number>(10_000, 1_000_000);

// Cache for StyledLine tokenization
const styledLineCache = new DataLimitedLruMap<StyledLine>(10_000, 1_000_000);

let styledLineCacheEnabled = true;

let currentStringWidth: StringWidthFunction = getStringWidth;

/**
 * Enable or disable the StyledLine tokenization cache at runtime.
 * Disabling clears the existing cache.
 */
export const setEnableStyledLineCache = (enabled: boolean): void => {
    styledLineCacheEnabled = enabled;

    if (!enabled) {
        styledLineCache.clear();
    }
};

/**
 * Clear only the StyledLine tokenization cache.
 */
export const clearStyledLineCache = (): void => {
    styledLineCache.clear();
};

/**
 * Replace the string width function used for text measurement.
 * Useful for terminals with non-standard character widths.
 * Clears the measurement cache when called.
 */
export const setStringWidthFunction = (function_: StringWidthFunction): void => {
    currentStringWidth = function_;
    clearStringWidthCache();
};

/**
 * Clear the string width measurement cache. Call this if the terminal
 * environment changes in a way that affects character widths.
 */
export const clearStringWidthCache = (): void => {
    cache.clear();
    widthCache.clear();
    styledLineCache.clear();
};

/**
 * Get the visual width of a single character, with caching and error handling.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export const inkCharacterWidth = (text: string): number => {
    // Fast path: printable ASCII single characters always have width 1.
    // Avoids the cache lookup + stringWidth call for the vast majority of
    // characters in typical output.
    if (text.length === 1) {
        const code = text.codePointAt(0);

        if (code !== undefined && code >= 32 && code < 127) {
            return 1;
        }
    }

    const cached = widthCache.get(text);

    if (cached !== undefined) {
        return cached;
    }

    let calculatedWidth: number;

    try {
        calculatedWidth = currentStringWidth(text);
    } catch {
        // Avoid crashing on invalid characters (e.g. lone surrogates).
        calculatedWidth = 1;
    }

    widthCache.set(text, calculatedWidth);

    return calculatedWidth;
};

/**
 * Get the visual width of a string, with error handling for invalid characters.
 */
const safeGetStringWidth = (text: string): number => {
    try {
        return currentStringWidth(text);
    } catch {
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
    let width = 0;

    for (const line of lines) {
        const w = safeGetStringWidth(line);

        if (w > width) {
            width = w;
        }
    }

    const height = lines.length;
    const dimensions = { height, width };

    cache.set(text, dimensions);

    return dimensions;
};

export default measureText;

// ── StyledLine-based API ─────────────────────────────────────────────

/**
 * Convert a text string to a StyledLine, with caching.
 * Uses the direct text → StyledLine pipeline (handles combining chars,
 * tabs, regional indicators, ANSI codes, etc.) without intermediate
 * StyledChar objects.
 */
export const toStyledLine = (text: string): StyledLine => {
    if (styledLineCacheEnabled) {
        const cached = styledLineCache.get(text);

        if (cached !== undefined) {
            return cached;
        }
    }

    const line = textToStyledLine(text);

    if (styledLineCacheEnabled) {
        styledLineCache.set(text, line);
    }

    return line;
};

/**
 * Get the total visual width of a StyledLine.
 */
export const styledLineWidth = (line: StyledLine): number => {
    let length = 0;

    for (let i = 0; i < line.length; i++) {
        length += inkCharacterWidth(line.getValue(i));
    }

    return length;
};

/**
 * Split a StyledLine by newline characters into multiple StyledLines.
 */
export const splitStyledLineByNewline = (line: StyledLine): StyledLine[] => {
    if (line.length === 0) {
        return [new StyledLine()];
    }

    const lines: StyledLine[] = [];
    let start = 0;

    for (let i = 0; i < line.length; i++) {
        if (line.getValue(i) === "\n") {
            lines.push(i > start ? line.slice(start, i) : new StyledLine());
            start = i + 1;
        }
    }

    lines.push(start < line.length ? line.slice(start) : new StyledLine());

    return lines;
};

/**
 * Measure the dimensions of a StyledLine (width of widest line, height in lines).
 */
export const measureStyledLine = (line: StyledLine): { height: number; width: number } => {
    if (line.length === 0) {
        return { height: 0, width: 0 };
    }

    const lines = splitStyledLineByNewline(line);
    let maxWidth = 0;

    for (const l of lines) {
        maxWidth = Math.max(maxWidth, styledLineWidth(l));
    }

    return { height: lines.length, width: maxWidth };
};
