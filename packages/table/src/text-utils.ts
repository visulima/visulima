import { stripVTControlCharacters } from "node:util";
import ansiRegex from "ansi-regex";
import stringWidth from "string-width";
import type { TruncateOptions } from "./types";

const globalAnsiPattern = ansiRegex();

/** Finds the real (non‑ANSI) character index in text corresponding to the visible position. */
function findRealPosition(text: string, visiblePosition: number): number {
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
        const charWidth = stringWidth(text[currentIndex]);
        if (visibleIndex + charWidth > visiblePosition) {
            return currentIndex;
        }
        visibleIndex += charWidth;
        currentIndex++;
    }
    return Math.min(stringWidth(text), visiblePosition) - 1;
}

/** Finds the index of the nearest space character to a target position. */
function getIndexOfNearestSpace(text: string, targetIndex: number, searchRight = false): number {
    if (text.charAt(targetIndex) === " ") {
        return targetIndex;
    }
    const direction = searchRight ? 1 : -1;
    for (let offset = 0; offset <= 3; offset++) {
        const pos = targetIndex + offset * direction;
        if (text.charAt(pos) === " ") {
            return pos;
        }
    }
    return targetIndex;
}

/** Preserves ANSI codes in a text slice. */
function preserveAnsiCodes(text: string, startIndex: number, endIndex: number): string {
    const openCodes: string[] = [];
    let match: RegExpExecArray | null = null;
    globalAnsiPattern.lastIndex = 0;
    while ((match = globalAnsiPattern.exec(text)) !== null) {
        if (match.index > endIndex) {
            break;
        }
        const code = match[0];
        if (code === "\u001B[0m") {
            if (match.index < endIndex) {
                openCodes.length = 0;
            }
        } else if (code.startsWith("\u001B[") && match.index < endIndex) {
            openCodes.push(code);
        }
    }
    const slicedText = text.slice(startIndex, endIndex);
    return openCodes.join("") + slicedText + (openCodes.length > 0 ? "\u001B[0m" : "");
}

/** Truncates text to a specified width while preserving ANSI codes. */
export function truncateText(text: string, maxWidth: number, options: Required<TruncateOptions>): string {
    if (typeof text !== "string") {
        throw new TypeError(`Expected input to be a string, got ${typeof text}`);
    }
    if (typeof maxWidth !== "number") {
        throw new TypeError(`Expected maxWidth to be a number, got ${typeof maxWidth}`);
    }
    if (maxWidth < 1) {
        return "";
    }
    if (maxWidth === 1) {
        return options.truncationCharacter;
    }
    const visibleLength = stringWidth(text);
    if (visibleLength <= maxWidth) {
        return text;
    }
    const lines = text.split("\n");
    let { truncationCharacter } = options;
    const truncatedLines = lines.map((line) => {
        const lineLength = stringWidth(line);
        if (lineLength <= maxWidth) {
            return line;
        }
        if (options.position === "start") {
            if (options.preferTruncationOnSpace) {
                const nearestSpace = getIndexOfNearestSpace(line, lineLength - maxWidth + 1, true);
                return truncationCharacter + preserveAnsiCodes(line, nearestSpace, line.length).trim();
            }
            if (options.space) {
                truncationCharacter += " ";
            }
            const visibleStart = stringWidth(line) - maxWidth + stringWidth(truncationCharacter);
            const realStart = findRealPosition(line, visibleStart);
            return truncationCharacter + preserveAnsiCodes(line, realStart, line.length);
        }
        if (options.position === "middle") {
            if (options.space) {
                truncationCharacter = ` ${truncationCharacter} `;
            }
            const halfWidth = Math.floor(maxWidth / 2);
            if (options.preferTruncationOnSpace) {
                const spaceNearFirst = getIndexOfNearestSpace(line, halfWidth);
                const spaceNearSecond = getIndexOfNearestSpace(line, line.length - (maxWidth - halfWidth) + 1, true);
                return (
                    preserveAnsiCodes(line, 0, spaceNearFirst) +
                    truncationCharacter +
                    preserveAnsiCodes(line, spaceNearSecond, line.length).trim()
                );
            }
            const firstHalf = findRealPosition(line, halfWidth);
            const secondHalfStart = stringWidth(line) - (maxWidth - halfWidth) + stringWidth(truncationCharacter);
            const secondHalf = findRealPosition(line, secondHalfStart);
            return preserveAnsiCodes(line, 0, firstHalf) + truncationCharacter + preserveAnsiCodes(line, secondHalf, line.length);
        }
        if (options.position === "end") {
            if (options.preferTruncationOnSpace) {
                const nearestSpace = getIndexOfNearestSpace(line, maxWidth - 1);
                return preserveAnsiCodes(line, 0, nearestSpace) + truncationCharacter;
            }
            if (options.space) {
                truncationCharacter = ` ${truncationCharacter}`;
            }
            const realEnd = findRealPosition(line, maxWidth - stringWidth(truncationCharacter));
            return preserveAnsiCodes(line, 0, realEnd) + truncationCharacter;
        }
        throw new Error(`Expected options.position to be either 'start', 'middle' or 'end', got ${options.position}`);
    });
    return truncatedLines.join("\n");
}

/** Word wraps text to a specified width while preserving ANSI codes. */
export function wordWrapText(text: string, maxWidth: number): string[] {
    if (maxWidth <= 0 || !text) {
        return [text];
    }
    if (stringWidth(text) <= maxWidth) {
        return [text];
    }
    const lines = text.split(/\r?\n/);
    const wrappedLines: string[] = [];
    const colorPattern = ansiRegex();
    const linkPattern = /\u001B\]8;;([^\u0007]*)\u0007([^\u0007]*)\u001B\]8;;\u0007/g;
    for (const line of lines) {
        if (!line.trim()) {
            wrappedLines.push(line);
            continue;
        }
        const formats: { index: number; sequence: string }[] = [];
        let plainText = line;
        let match: RegExpExecArray | null = null;
        colorPattern.lastIndex = 0;
        while ((match = colorPattern.exec(line)) !== null) {
            formats.push({ index: match.index, sequence: match[0] });
        }
        linkPattern.lastIndex = 0;
        while ((match = linkPattern.exec(line)) !== null) {
            formats.push({
                index: match.index,
                sequence: `\u001B]8;;${match[1]}\u0007${match[2]}\u001B\]8;;\u0007`,
            });
        }
        formats.sort((a, b) => a.index - b.index);
        plainText = stripVTControlCharacters(line);
        const words = plainText.split(/\s+/);
        let currentLine = "";
        let currentLineWidth = 0;
        let lastAnsi = "";
        for (const word of words) {
            const wordWidth = stringWidth(word);
            if (currentLineWidth + wordWidth + (currentLine ? 1 : 0) > maxWidth && currentLine) {
                if (lastAnsi) {
                    currentLine += "\u001B[0m";
                }
                wrappedLines.push(currentLine);
                currentLine = "";
                currentLineWidth = 0;
            }
            if (currentLine) {
                currentLine += " ";
                currentLineWidth += 1;
            }
            if (lastAnsi) {
                currentLine += lastAnsi;
            }
            const wordStart = plainText.indexOf(word);
            let formattedWord = word;
            for (const format of formats) {
                if (format.index <= wordStart) {
                    if (format.sequence.startsWith("\u001B[")) {
                        lastAnsi = format.sequence;
                    }
                    formattedWord = format.sequence + formattedWord;
                }
            }
            currentLine += formattedWord;
            currentLineWidth += wordWidth;
        }
        if (currentLine) {
            if (lastAnsi) {
                currentLine += "\u001B[0m";
            }
            wrappedLines.push(currentLine);
        }
    }
    return wrappedLines;
}
