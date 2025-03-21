import ansiRegex from "ansi-regex";
import { getStringWidth } from "@visulima/string";

interface AnsiRange {
    start: number;
    end: number;
}

/** Finds the real (non‑ANSI) character index in text corresponding to the visible position. */
export const findRealPosition = (text: string, visiblePosition: number): number => {
    if (!text) {
        return 0;
    }

    if (visiblePosition < 0) {
        return 0;
    }

    // First collect all ANSI ranges
    const ansiRanges: AnsiRange[] = [];
    const ansiPattern = ansiRegex();
    let match: RegExpExecArray | null;

    // Reset lastIndex to ensure we find all matches
    ansiPattern.lastIndex = 0;
    while ((match = ansiPattern.exec(text)) !== null) {
        ansiRanges.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // Remove ANSI codes to get clean text for width calculations
    const cleanText = text.replace(ansiPattern, "");
    const totalVisibleWidth = getStringWidth(cleanText);

    // If requested position is beyond text width, return text length
    if (visiblePosition >= totalVisibleWidth) {
        return text.length;
    }

    // Build a mapping of clean text positions to real text positions
    const realPositions: number[] = [];
    let cleanIndex = 0;
    let realIndex = 0;

    // Map clean text positions to real positions
    while (cleanIndex < cleanText.length) {
        // Skip ANSI codes
        while (realIndex < text.length) {
            let isAnsi = false;
            for (const range of ansiRanges) {
                if (realIndex >= range.start && realIndex < range.end) {
                    isAnsi = true;
                    realIndex++;
                    break;
                }
            }
            if (!isAnsi) break;
        }

        realPositions[cleanIndex] = realIndex;
        cleanIndex++;
        realIndex++;
    }

    // Now map visible positions to clean text positions
    let visiblePos = 0;
    let targetCleanIndex = 0;

    // For each character in the clean text
    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const width = getStringWidth(char);

        // If we've found our target position
        if (visiblePos === visiblePosition) {
            targetCleanIndex = i;
            break;
        }

        // For wide characters
        if (width === 2) {
            // If we're at the second cell of a wide character
            if (visiblePos + 1 === visiblePosition) {
                targetCleanIndex = i + 1;
                break;
            }
            visiblePos += 2;
        } else {
            visiblePos++;
        }

        // If we've reached the target position after incrementing
        if (visiblePos === visiblePosition) {
            targetCleanIndex = i + 1;
            break;
        }
    }

    // If we haven't found a target index and we're at the end
    if (targetCleanIndex === 0 && visiblePosition >= visiblePos) {
        targetCleanIndex = cleanText.length;
    }

    // Map the clean text position back to the real position
    const realPos = realPositions[targetCleanIndex] ?? text.length;

    // Find the next non-ANSI position
    let finalPos = realPos;
    while (finalPos < text.length) {
        let isAnsi = false;
        for (const range of ansiRanges) {
            if (finalPos >= range.start && finalPos < range.end) {
                isAnsi = true;
                break;
            }
        }
        if (!isAnsi) break;
        finalPos++;
    }

    return finalPos;
};
