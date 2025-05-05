import type { Interval, IntervalArray } from "./types";

// eslint-disable-next-line import/prefer-default-export
export { default as LRUCache } from "./utils/lru-cache";

/**
 * Escapes characters with special meaning in regular expressions.
 * @param str The string to escape.
 * @returns The escaped string.
 */
export function escapeRegExp(str: string): string {
    // $& means the whole matched string
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks if a number falls within any of the specified intervals.
 * @param num The number to check.
 * @param ranges An array of intervals [start, end].
 * @returns True if the number is within any interval, false otherwise.
 */
export function inRange(num: number, ranges: IntervalArray): boolean {
    return ranges.some((range) => num >= range[0] && num <= range[1]);
}

/**
 * Checks if a string contains Chinese characters (Han script).
 * @param str The string to check.
 * @returns True if the string contains Chinese characters, false otherwise.
 */
export function hasChinese(str: string): boolean {
    // Uses Unicode property escapes for Han script
    return /\p{Script=Han}/u.test(str);
}

/**
 * Checks if a string contains punctuation or space characters.
 * @param str The string to check.
 * @returns True if the string contains punctuation or space, false otherwise.
 */
export function hasPunctuationOrSpace(str: string): boolean {
    // Uses Unicode property escapes for Punctuation and general category for Space
    return /[\p{P}\p{Z}]/u.test(str);
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

/**
 * Custom RegExp replace function to replace all unnecessary strings into target replacement string
 * @param source Source string
 * @param regexp Used to search through the source string
 * @param replacement Replace matched RegExp with replacement value
 * @param ignored Ignore certain string values within the matched strings
 */
export function regexpReplaceCustom(source: string, regexp: RegExp, replacement: string, ignored: string[] = []): string {
    // RegExp version of ignored
    const ignoredRegexp = ignored.length ? RegExp(ignored.map(escapeRegExp).join("|"), "g") : null;
    // clones regex and with g flag
    const rule = RegExp(regexp.source, regexp.flags.replace("g", "") + "g");
    // final result
    let result = "";
    // used to count where
    let lastIndex = 0;
    while (true) {
        const matchMain = rule.exec(source);
        let ignoreResult = "";
        let ignoreLastIndex = 0;
        if (matchMain) {
            const matchedString = matchMain[0];
            if (ignoredRegexp) {
                ignoredRegexp.lastIndex = 0; // Reset lastIndex for ignoredRegexp
                while (true) {
                    const matchIgnore = ignoredRegexp.exec(matchedString);
                    if (matchIgnore) {
                        // Add replacement for the part before the ignored string
                        if (matchIgnore.index > ignoreLastIndex) {
                            ignoreResult += replacement;
                        }
                        // Add the ignored string itself
                        ignoreResult += matchIgnore[0];
                        ignoreLastIndex = ignoredRegexp.lastIndex;
                    } else {
                        // Add replacement for the part after the last ignored string (or the whole string if no ignores)
                        if (matchedString.length > ignoreLastIndex) {
                            ignoreResult += replacement;
                        }
                        break;
                    }
                }
            } else {
                // No ignored strings, just use the replacement for the whole match
                ignoreResult = replacement;
            }

            result += source.substring(lastIndex, matchMain.index) + ignoreResult;
            lastIndex = rule.lastIndex;
        } else {
            result += source.substring(lastIndex);
            break;
        }
    }
    return result;
}
