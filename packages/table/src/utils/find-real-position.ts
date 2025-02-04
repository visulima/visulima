import ansiRegex from "ansi-regex";
import stringWidth from "string-width";

const globalAnsiPattern = ansiRegex();

/** Finds the real (non‑ANSI) character index in text corresponding to the visible position. */
export const findRealPosition = (text: string, visiblePosition: number): number => {
    let visibleIndex = 0;
    let match: RegExpExecArray | null = null;

    const ansiRanges: { end: number; start: number }[] = [];

    globalAnsiPattern.lastIndex = 0;

    while ((match = globalAnsiPattern.exec(text)) !== null) {
        ansiRanges.push({ end: match.index + match[0].length, start: match.index });
    }

    let currentIndex = 0;

    while (currentIndex < text.length) {
        const range = ansiRanges.find((r) => currentIndex >= r.start && currentIndex < r.end);

        if (range) {
            currentIndex = range.end;
            continue;
        }

        const charWidth = stringWidth(text[currentIndex] as string);

        if (visibleIndex + charWidth > visiblePosition) {
            return currentIndex;
        }

        visibleIndex += charWidth;
        currentIndex++;
    }

    return Math.min(stringWidth(text), visiblePosition) - 1;
};
