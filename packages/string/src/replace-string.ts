import type { Interval, IntervalArray, OptionReplaceArray } from "./types";
import { escapeRegExp } from "./utils";

/**
 * Represents a potential replacement match found during processing.
 * @internal
 */
interface PotentialMatch {
    start: number; // Inclusive start index in the original source
    end: number; // Inclusive end index in the original source
    replacement: string;
    original: string;
    id: number; // Unique ID for tracking applied matches
}

/**
 * Represents a character in the source string with processing state.
 * @internal
 */
interface ProcessedChar {
    char: string;
    index: number;
    isIgnored: boolean;
    appliedMatchId: number | null; // ID of the NON-ZERO-LENGTH match that covers this char
    isMatchStart: boolean; // True if this is the first char of the applied non-zero-length match
    matchReplacement: string | null; // Replacement string if isMatchStart
    insertBeforeReplacement: string | null; // For zero-length matches occurring BEFORE this index
}

/**
 * Merges overlapping or adjacent intervals. E.g., [[0, 5], [3, 7], [9, 10]] becomes [[0, 7], [9, 10]].
 * Assumes intervals are sorted by start index.
 * @internal
 */
const mergeIntervals = (intervals: IntervalArray): IntervalArray => {
    if (intervals.length === 0) {
        return [];
    }

    const merged: IntervalArray = [];

    let currentMerge = [...(intervals[0] as Interval)];

    for (let i = 1; i < intervals.length; i++) {
        const next = intervals[i];

        if (next[0] <= currentMerge[1] + 1) {
            currentMerge[1] = Math.max(currentMerge[1], next[1]);
        } else {
            merged.push(currentMerge);
            currentMerge = [...next];
        }
    }

    merged.push(currentMerge);

    return merged;
};

/**
 * Performs multiple string or RegExp replacements using a refined pre-processing approach.
 */
const replaceString = (source: string, searches: OptionReplaceArray, ignoreRanges: IntervalArray): string => {
    if (!source) return "";

    // Find all potential matches
    const potentialMatches: PotentialMatch[] = [];
    let matchIdCounter = 0;
    for (const item of searches) {
        if (!item || item.length < 2) {
            continue;
        }

        const [searchKey, replacementValue] = item;

        if (replacementValue === undefined) {
            continue;
        }

        let searchPattern: RegExp;

        try {
            if (searchKey instanceof RegExp) {
                searchPattern = new RegExp(searchKey.source, `${searchKey.flags.replace("g", "")}g`);
            } else if (typeof searchKey === "string" && searchKey.length > 0) {
                searchPattern = new RegExp(escapeRegExp(searchKey), "g");
            } else {
                continue;
            }

            let match: RegExpExecArray | null;

            while ((match = searchPattern.exec(source)) !== null) {
                const start = match.index;
                const original = match[0];
                if (original.length === 0 && searchPattern.lastIndex === match.index) {
                    searchPattern.lastIndex++; // Avoid infinite loop on zero-length matches
                }

                const end = start + original.length - 1; // Inclusive end
                const finalReplacement = replacementValue.replace(/\$(\d+|&)/g, (_, group) => {
                    if (group === "&") {
                        return original;
                    }

                    const groupIndex = parseInt(group, 10);

                    return groupIndex > 0 && groupIndex < match.length ? (match[groupIndex] ?? "") : "";
                });

                potentialMatches.push({ start, end, replacement: finalReplacement, original, id: matchIdCounter++ });

                // Ensure regex advances even if a zero-length match was found at the start index
                if (original.length === 0 && searchPattern.lastIndex === start) {
                    searchPattern.lastIndex++;
                }
            }
        } catch (error) {
            console.error(`Error processing search key ${String(searchKey)}:`, error);
            continue;
        }
    }

    // Sort potential matches (start asc, length desc)
    potentialMatches.sort((a, b) => {
        if (a.start !== b.start) {
            return a.start - b.start;
        }

        return b.end - a.end; // Longer first
    });

    // Sort and merge ignore ranges
    const sortedIgnores = [...ignoreRanges].sort((a, b) => a[0] - b[0]);
    const mergedIgnores = mergeIntervals(sortedIgnores);

    // Create processed character array
    const processedChars: ProcessedChar[] = source.split("").map((char, index) => ({
        char,
        index,
        isIgnored: false,
        appliedMatchId: null,
        isMatchStart: false,
        matchReplacement: null,
        insertBeforeReplacement: null,
    }));

    // Mark ignored characters
    for (const range of mergedIgnores) {
        for (let i = range[0]; i <= range[1]; i++) {
            if (processedChars[i]) {
                processedChars[i].isIgnored = true;
            }
        }
    }

    // Apply matches to processed array
    // @performance This loop iterates through all potential matches and checks for
    // overlaps by examining each character within the match range. For scenarios
    // with many long, overlapping matches, optimizing the overlap check (e.g.,
    // using an interval tree or sorted interval list for applied ranges) might
    // improve performance, but adds complexity.
    let insertionAfterEnd = ""; // Store zero-length replacements targeted *after* the last char

    // First, handle all zero-length matches - they insert without consuming/overlapping
    for (const match of potentialMatches) {
        if (match.original.length === 0) {
            if (match.start >= 0 && match.start <= processedChars.length) {
                // Allow insertion at or after last char
                const targetIndex = match.start;

                if (processedChars[targetIndex]) {
                    // Insertion *before* an existing character
                    const targetChar = processedChars[targetIndex];

                    if (!targetChar.isIgnored) {
                        targetChar.insertBeforeReplacement = (targetChar.insertBeforeReplacement ?? "") + match.replacement;
                    }
                } else if (targetIndex === processedChars.length) {
                    // Insertion *after* the last character
                    insertionAfterEnd += match.replacement;
                }
            }
        }
    }

    // Now, handle non-zero-length matches, considering precedence and overlaps
    for (const match of potentialMatches) {
        if (match.original.length === 0) {
            continue;
        }

        let canApply = true;
        // Check for overlaps with ignores or already applied matches
        for (let i = match.start; i <= match.end; i++) {
            if (
                !processedChars[i] || // Out of bounds
                processedChars[i].isIgnored || // Overlaps ignore
                processedChars[i].appliedMatchId !== null // Overlaps higher-priority match
            ) {
                canApply = false;
                break;
            }
        }

        if (canApply) {
            // Apply this valid match
            if (match.start >= 0 && match.start < processedChars.length) {
                // Mark characters covered by this match
                for (let i = match.start; i <= match.end; i++) {
                    if (processedChars[i]) {
                        processedChars[i].appliedMatchId = match.id;
                    }
                }
                // Mark the start for replacement action
                processedChars[match.start].isMatchStart = true;
                processedChars[match.start].matchReplacement = match.replacement;
            }
        }
    }

    // Build result string
    let result = "";
    let currentIndex = 0;

    while (currentIndex < processedChars.length) {
        const pChar = processedChars[currentIndex];

        // Append any zero-length replacements occurring before this character
        if (pChar.insertBeforeReplacement !== null) {
            result += pChar.insertBeforeReplacement;
        }

        if (pChar.isMatchStart && pChar.appliedMatchId !== null) {
            // Start of an applied non-zero-length match
            result += pChar.matchReplacement ?? "";

            // Find the end index of this match
            let matchEndIndex = currentIndex;
            for (let i = currentIndex + 1; i < processedChars.length; i++) {
                if (processedChars[i]?.appliedMatchId === pChar.appliedMatchId) {
                    matchEndIndex = i;
                } else {
                    break;
                }
            }
            currentIndex = matchEndIndex + 1; // Advance index past the entire match
        } else if (pChar.appliedMatchId === null) {
            // Append character if not part of an applied match (includes ignored characters)
            result += pChar.char;
            currentIndex++;
        } else {
            // Character is part of an applied match, but not the start - skip it.
            currentIndex++;
        }
    }

    // Append any zero-length matches that occurred after the last character
    if (insertionAfterEnd.length > 0) {
        result += insertionAfterEnd;
    }

    return result;
};

export default replaceString;
