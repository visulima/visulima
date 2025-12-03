import type { Interval, IntervalArray, OptionReplaceArray } from "./types";

/**
 * Represents a potential replacement match found during processing.
 * @internal
 */
interface PotentialMatch {
    end: number; // Inclusive end index in the original source
    id: number; // Unique ID for tracking applied matches
    original: string;
    replacement: string;
    start: number; // Inclusive start index in the original source
}

/**
 * Represents a character in the source string with processing state.
 * @internal
 */
interface ProcessedChar {
    appliedMatchId: number | null; // ID of the NON-ZERO-LENGTH match that covers this char
    char: string;
    index: number;
    insertBeforeReplacement: string | null; // For zero-length matches occurring BEFORE this index
    isIgnored: boolean;
    isMatchStart: boolean; // True if this is the first char of the applied non-zero-length match
    matchReplacement: string | null; // Replacement string if isMatchStart
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

    let currentMerge: Interval = [...(intervals[0] as Interval)];

    // eslint-disable-next-line no-plusplus
    for (let index = 1; index < intervals.length; index++) {
        const next = intervals[index];

        if (next && next[0] <= (currentMerge[1] as number) + 1) {
            currentMerge[1] = Math.max(currentMerge[1] as number, next[1] as number);
        } else {
            merged.push(currentMerge as Interval);
            currentMerge = [...(next as Interval)];
        }
    }

    merged.push(currentMerge as Interval);

    return merged;
};

/**
 * Performs multiple string or RegExp replacements using a refined pre-processing approach.
 * @param source The string to search and replace in.
 * @param searches An array of search/replace pairs.
 * @param ignoreRanges An array of ignored ranges.
 * @returns The string with replacements applied.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const replaceString = (source: string, searches: OptionReplaceArray, ignoreRanges: IntervalArray): string => {
    if (!source) {
        return "";
    }

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

        try {
            if (searchKey instanceof RegExp) {
                const searchPattern = new RegExp(searchKey.source, `${searchKey.flags.replace("g", "")}g`);

                let match: RegExpExecArray | null;

                // eslint-disable-next-line no-cond-assign
                while ((match = searchPattern.exec(source)) !== null) {
                    const start = match.index;
                    const original = match[0] as string;

                    if (original.length === 0 && searchPattern.lastIndex === match.index) {
                        searchPattern.lastIndex += 1; // Avoid infinite loop on zero-length matches
                    }

                    const end = start + original.length - 1;

                    const finalReplacement = replacementValue.replaceAll(/\$([\d&$`'])/g, (substringFound, capturedSymbolOrDigits) => {
                        if (capturedSymbolOrDigits === "&") {
                            return original;
                        }

                        if (capturedSymbolOrDigits === "$") {
                            return "$";
                        }

                        if (capturedSymbolOrDigits === "`") {
                            return source.slice(0, Math.max(0, start));
                        }

                        if (capturedSymbolOrDigits === "'") {
                            return source.slice(Math.max(0, start + original.length));
                        }

                        const groupIndex = Number.parseInt(capturedSymbolOrDigits, 10);

                        if (match && groupIndex > 0 && groupIndex < match.length) {
                            return match[groupIndex] ?? "";
                        }

                        return substringFound;
                    });

                    // eslint-disable-next-line no-plusplus
                    potentialMatches.push({ end, id: matchIdCounter++, original, replacement: finalReplacement, start });

                    if (original.length === 0 && searchPattern.lastIndex === start) {
                        searchPattern.lastIndex += 1;
                    }
                }
            } else if (typeof searchKey === "string" && searchKey.length > 0) {
                // eslint-disable-next-line no-plusplus,no-cond-assign
                for (let index = 0; (index = source.indexOf(searchKey, index)) !== -1; index++) {
                    const start = index;
                    const original = searchKey;
                    const end = start + original.length - 1;

                    // Mock a match object for the replacement logic ($& and $$ are supported)
                    const mockMatch: RegExpExecArray = Object.assign([original], { index: start, input: source }) as RegExpExecArray;

                    const finalReplacement = replacementValue.replaceAll(/\$(\d+|&|\$)/g, (substringFound, capturedSymbolOrDigits) => {
                        if (capturedSymbolOrDigits === "&") {
                            return original; // original is match[0]
                        }

                        if (capturedSymbolOrDigits === "$") {
                            return "$";
                        }

                        // For string searchKey, mockMatch has length 1 (only the full string).
                        // So, groupIndex > 0 will effectively not find $1, $2, etc.
                        // Literal $1, $2 in replacementValue will pass through if not caught by this regex.
                        const groupIndex = Number.parseInt(capturedSymbolOrDigits, 10);

                        if (mockMatch && groupIndex > 0 && groupIndex < mockMatch.length) {
                            // This branch will likely not be hit for $N with N > 0 for string searches

                            return mockMatch[groupIndex] ?? "";
                        }

                        return substringFound; // Returns $N as is, or the original char if not $& or $$
                    });

                    // eslint-disable-next-line no-plusplus
                    potentialMatches.push({ end, id: matchIdCounter++, original, replacement: finalReplacement, start });
                }
            } else {
                continue;
            }
        } catch {
            continue;
        }
    }

    potentialMatches.sort((a, b) => {
        if (a.start !== b.start) {
            return a.start - b.start;
        }

        return b.end - a.end;
    });

    const sortedIgnores = [...ignoreRanges].sort((a, b) => a[0] - b[0]);
    const mergedIgnores = mergeIntervals(sortedIgnores);

    // eslint-disable-next-line unicorn/prefer-spread
    const processedChars: ProcessedChar[] = source.split("").map((char, index) => {
        return {
            appliedMatchId: null,
            char,
            index,
            insertBeforeReplacement: null,
            isIgnored: false,
            isMatchStart: false,
            matchReplacement: null,
        };
    });

    // Mark ignored characters
    for (const range of mergedIgnores) {
        // eslint-disable-next-line no-plusplus
        for (let index = range[0]; index <= range[1]; index++) {
            if (processedChars[index]) {
                (processedChars[index] as ProcessedChar).isIgnored = true;
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
        if (match.original.length === 0 && match.start >= 0 && match.start <= processedChars.length) {
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

    // Now, handle non-zero-length matches, considering precedence and overlaps
    for (const match of potentialMatches) {
        if (match.original.length === 0) {
            continue;
        }

        let canApply = true;

        // Check for overlaps with ignores or already applied matches
        // eslint-disable-next-line no-plusplus
        for (let index = match.start; index <= match.end; index++) {
            if (

                !processedChars[index] // Out of bounds

                || (processedChars[index] as ProcessedChar).isIgnored // Overlaps ignore

                || (processedChars[index] as ProcessedChar).appliedMatchId !== null // Overlaps higher-priority match
            ) {
                canApply = false;
                break;
            }
        }

        if (
            canApply // Apply this valid match
            && match.start >= 0
            && match.start < processedChars.length
        ) {
            // Mark characters covered by this match
            // eslint-disable-next-line no-plusplus
            for (let index = match.start; index <= match.end; index++) {
                if (processedChars[index]) {
                    (processedChars[index] as ProcessedChar).appliedMatchId = match.id;
                }
            }
            // Mark the start for replacement action

            if (processedChars[match.start]) {
                (processedChars[match.start] as ProcessedChar).isMatchStart = true;
                (processedChars[match.start] as ProcessedChar).matchReplacement = match.replacement;
            }
        }
    }

    // Build result string
    let result = "";
    let currentIndex = 0;

    while (currentIndex < processedChars.length) {
        const pChar = processedChars[currentIndex] as ProcessedChar;

        // Append any zero-length replacements occurring before this character
        if (pChar.insertBeforeReplacement !== null) {
            result += pChar.insertBeforeReplacement;
        }

        if (pChar.isMatchStart && pChar.appliedMatchId !== null) {
            // Start of an applied non-zero-length match
            result += pChar.matchReplacement ?? "";

            // Find the end index of this match
            let matchEndIndex = currentIndex;

            // eslint-disable-next-line no-plusplus
            for (let index = currentIndex + 1; index < processedChars.length; index++) {
                if (processedChars[index]?.appliedMatchId === pChar.appliedMatchId) {
                    matchEndIndex = index;
                } else {
                    break;
                }
            }

            currentIndex = matchEndIndex + 1; // Advance index past the entire match
        } else if (pChar.appliedMatchId === null) {
            // Append character if not part of an applied match (includes ignored characters)
            result += pChar.char;

            currentIndex += 1;
        } else {
            // Character is part of an applied match, but not the start - skip it.

            currentIndex += 1;
        }
    }

    // Append any zero-length matches that occurred after the last character
    if (insertionAfterEnd.length > 0) {
        result += insertionAfterEnd;
    }

    return result;
};

export default replaceString;
