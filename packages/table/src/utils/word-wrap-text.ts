import { stripVTControlCharacters } from "node:util";

import ansiRegex from "ansi-regex";
import stringWidth from "string-width";

const globalAnsiPattern = ansiRegex();

/** Word wraps text to a specified width, handling ANSI codes. */
export const wordWrapText = (text: string, maxWidth: number): string[] => {
    if (maxWidth <= 0 || !text) {
        return [text];
    }

    if (stringWidth(text) <= maxWidth) {
        return [text];
    }

    const lines = text.split(/\r?\n/);
    const wrappedLines: string[] = [];
    const linkPattern = /\u001B\]8;;([^\u0007]*)\u0007([^\u0007]*)\u001B\]8;;\u0007/g;

    for (const line of lines) {
        if (!line.trim()) {
            wrappedLines.push(line);
            continue;
        }

        const formats: { index: number; sequence: string }[] = [];

        let plainText = line;
        let match: RegExpExecArray | null = null;

        globalAnsiPattern.lastIndex = 0;

        while ((match = globalAnsiPattern.exec(line)) !== null) {
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
};
