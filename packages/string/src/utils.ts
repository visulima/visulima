import type { Interval, IntervalArray } from "./types";

 
export { default as LRUCache } from "./utils/lru-cache";

/**
 * Escapes characters with special meaning in regular expressions.
 * @param str The string to escape.
 * @returns The escaped string.
 */
export function escapeRegExp(string_: string): string {
    // $& means the whole matched string
    return string_.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
export function hasChinese(string_: string): boolean {
    // Uses Unicode property escapes for Han script
    return /\p{Script=Han}/u.test(string_);
}

/**
 * Checks if a string contains punctuation or space characters.
 * @param str The string to check.
 * @returns True if the string contains punctuation or space, false otherwise.
 */
export function hasPunctuationOrSpace(string_: string): boolean {
    // Uses Unicode property escapes for Punctuation and general category for Space
    return /[\p{P}\p{Z}]/u.test(string_);
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
 * @param ignoreRanges Ignore certain string values within the matched strings
 */
export function regexpReplaceCustom(source: string, regexp: RegExp, replacement: string, ignoreRanges: IntervalArray = []): string {
    // clones regex and with g flag
    const rule = new RegExp(regexp.source, regexp.flags.replace("g", "") + "g");
    // final result
    let result = "";
    // used to count where
    let lastIndex = 0;
    while (true) {
        const matchMain = rule.exec(source);
        if (matchMain) {
            const matchStartIndex = matchMain.index;
            const matchEndIndex = matchStartIndex + matchMain[0].length - 1;
            const matchedString = matchMain[0];

            // Check if the match overlaps with any ignore range
            const isIgnored = ignoreRanges.some(
                (range) =>
                    // Check for overlap: (Range1Start <= Range2End) and (Range1End >= Range2Start)
                    matchStartIndex <= range[1] && matchEndIndex >= range[0],
            );

            let stringToAppend: string;
            if (isIgnored) {
                // If ignored, append the original matched string
                stringToAppend = matchedString;
            } else {
                // If not ignored, use the replacement value
                // (The complex logic for partial ignores within a match is removed for simplicity,
                // as the main transliterate loop now handles ignoring character by character)
                stringToAppend = replacement;
            }

            result += source.substring(lastIndex, matchStartIndex) + stringToAppend;
            lastIndex = rule.lastIndex;
        } else {
            result += source.substring(lastIndex);
            break;
        }
    }
    return result;
}
