import type { Interval, IntervalArray, OptionReplaceArray } from "./types";

export { default as LRUCache } from "./utils/lru-cache";

/**
 * Escapes characters with special meaning in regular expressions.
 * @param str The string to escape.
 * @returns The escaped string.
 */
export function escapeRegExp(char: string): string {
    // $& means the whole matched string
    return char.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks if a number falls within any of the specified intervals.
 * @param num The number to check.
 * @param ranges An array of intervals [start, end].
 * @returns True if the number is within any interval, false otherwise.
 */
export function inRange(number_: number, ranges: IntervalArray): boolean {
    return ranges.some((range) => number_ >= range[0] && number_ <= range[1]);
}

/**
 * Checks if a string contains Chinese characters (Han script).
 * @param str The string to check.
 * @returns True if the string contains Chinese characters, false otherwise.
 */
export function hasChinese(char: string): boolean {
    return /[\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u3005\u3007\u3021-\u3029\u3038-\u303B\u3400-\u4DBF\u4E00-\u9FFC\uF900-\uFA6D\uFA70-\uFAD9]|\uD81B[\uDFF0\uDFF1]|[\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879\uD880-\uD883][\uDC00-\uDFFF]|\uD869[\uDC00-\uDEDD\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uD884[\uDC00-\uDF4A]/.test(
        char,
    );
}

/**
 * Checks if a string contains punctuation or space characters.
 * @param str The string to check.
 * @returns True if the string contains punctuation or space, false otherwise.
 */
export function hasPunctuationOrSpace(char: string): boolean {
    // Uses Unicode property escapes for Punctuation and general category for Space
    return /[\p{P}\p{Z}]/u.test(char);
}

/**
 * Finds all occurrences of a set of substrings within a source string and returns their start/end indices.
 * @param source The string to search within.
 * @param needles An array of strings to search for.
 * @returns An array of intervals [start, end] for each occurrence.
 */
export function findStrOccurrences(source: string, needles: string[]): IntervalArray {
    const ranges: IntervalArray = [];
    if (!needles || needles.length === 0) {
        return ranges;
    }

    needles.forEach((needle) => {
        if (typeof needle !== "string" || needle.length === 0) {
            return; // Skip invalid needles
        }
        let startIndex = 0;
        let index;
        while ((index = source.indexOf(needle, startIndex)) > -1) {
            const end = index + needle.length - 1;
            ranges.push([index, end]);
            startIndex = index + 1; // Move past the start of the current match
        }
    });

    // Sort and merge overlapping/adjacent intervals for cleaner output
    if (ranges.length === 0) {
        return [];
    }

    ranges.sort((a, b) => a[0] - b[0]);

    const merged: IntervalArray = [];
    let currentRange: Interval | null = null;

    for (const range of ranges) {
        if (currentRange === null) {
            currentRange = [...range];
        } else if (range[0] <= currentRange[1] + 1) {
            // Merge overlapping or adjacent ranges
            currentRange[1] = Math.max(currentRange[1], range[1]);
        } else {
            // Disjoint range, push the previous one and start a new one
            merged.push(currentRange);
            currentRange = [...range];
        }
    }

    if (currentRange !== null) {
        merged.push(currentRange);
    }

    return merged;
}
