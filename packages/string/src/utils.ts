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
 * Represents a potential replacement match.
 */
interface PotentialMatch {
    start: number;
    end: number;
    replacement: string;
    original: string;
}

/**
 * Search and replace a list of strings/regexps respecting ignore ranges.
 * Builds the string segment by segment, applying only non-overlapping, non-ignored replacements.
 */
export function replaceString(source: string, searches: OptionReplaceArray, ignoreRanges: IntervalArray): string {
    // console.log(`[replaceString] Initial Source: "${source}", Ignores: ${JSON.stringify(ignoreRanges)}`); // Keep log for now
    const potentialMatches: PotentialMatch[] = [];

    // 1. Find all potential matches from the original source string
    for (const item of searches) {
        if (!item || item.length < 2) continue;
        const [searchKey, replacementValue] = item;
        if (replacementValue === undefined) continue;

        let searchPattern: RegExp;
        try {
             if (searchKey instanceof RegExp) {
                // Ensure the regex has the global flag for exec to work correctly in a loop
                searchPattern = new RegExp(searchKey.source, `${searchKey.flags.replace("g", "")}g`);
            } else if (typeof searchKey === "string" && searchKey.length > 0) {
                searchPattern = new RegExp(escapeRegExp(searchKey), "g");
            } else {
                continue; // Skip invalid search keys
            }

            let match;
            while ((match = searchPattern.exec(source)) !== null) {
                const start = match.index;
                const end = start + match[0].length - 1;
                const original = match[0];

                // Handle $ replacements in the replacement string here
                const finalReplacement = replacementValue.replace(/\$(\d+|&)/g, (_, group) => {
                    if (group === '&') return original;
                    const groupIndex = parseInt(group, 10);
                    return groupIndex > 0 && groupIndex < match.length ? match[groupIndex] ?? '' : '';
                });

                potentialMatches.push({ start, end, replacement: finalReplacement, original });

                // Prevent infinite loops for zero-length matches
                if (match[0].length === 0) {
                     if (searchPattern.lastIndex >= source.length) break;
                    searchPattern.lastIndex++;
                }
            }
        } catch (error) {
             console.error(`Error processing search key ${String(searchKey)}:`, error);
             continue;
        }
    }

    // 2. Sort potential matches by start index, then by length descending (longer matches take precedence)
    potentialMatches.sort((a, b) => {
        if (a.start !== b.start) {
            return a.start - b.start;
        }
        return b.end - a.end; // Longer match first if starts are equal
    });

    // 3. Build the result string, applying non-overlapping, non-ignored matches
    let result = "";
    let lastIndex = 0;
    const appliedRanges: IntervalArray = []; // Keep track of where replacements were made

    for (const match of potentialMatches) {
        // Check for overlap with already applied replacements
        const overlapsApplied = appliedRanges.some(
            (applied) => match.start <= applied[1] && match.end >= applied[0]
        );
        if (overlapsApplied) {
            continue; // Skip this match if it overlaps with one already applied
        }

        // Check for overlap with ignored ranges
        const isIgnored = ignoreRanges.some(
            (ignored) => match.start <= ignored[1] && match.end >= ignored[0]
        );
        if (isIgnored) {
            continue; // Skip this match if it overlaps with an ignored range
        }

        // If we reach here, the match is valid and should be applied
        // Append the text from the last index up to the start of this match
        if (match.start > lastIndex) {
             result += source.substring(lastIndex, match.start);
        }
        // Append the replacement
        result += match.replacement;
        // Update the last index to the end of this match
        lastIndex = match.end + 1;
        // Record the range that was replaced
        appliedRanges.push([match.start, match.end]);
    }

    // 4. Append any remaining part of the source string
    if (lastIndex < source.length) {
        result += source.substring(lastIndex);
    }

    return result;
}
