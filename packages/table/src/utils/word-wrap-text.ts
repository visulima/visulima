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

        // Collect ANSI codes
        globalAnsiPattern.lastIndex = 0;
        while ((match = globalAnsiPattern.exec(line)) !== null) {
            formats.push({ index: match.index, sequence: match[0] });
        }

        // Collect hyperlinks
        linkPattern.lastIndex = 0;
        while ((match = linkPattern.exec(line)) !== null) {
            formats.push({
                index: match.index,
                sequence: `\u001B]8;;${match[1]}\u0007${match[2]}\u001B\]8;;\u0007`,
            });
        }

        formats.sort((a, b) => a.index - b.index);
        plainText = stripVTControlCharacters(line);

        let currentLine = "";
        let currentLineWidth = 0;
        let activeAnsiCodes: string[] = [];
        let position = 0;

        // Split text into words
        const words = plainText.split(/\s+/);
        let currentWord = "";
        let currentWordWidth = 0;

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const wordWidth = stringWidth(word);

            // Apply any ANSI codes at the current position
            for (const format of formats) {
                if (format.index === position) {
                    if (format.sequence.startsWith("\u001B[")) {
                        if (format.sequence === "\u001B[0m") {
                            activeAnsiCodes = [];
                        } else {
                            activeAnsiCodes.push(format.sequence);
                        }
                        currentLine += format.sequence;
                    }
                }
            }

            // If the word is too long, split it
            if (wordWidth > maxWidth) {
                if (currentLineWidth > 0) {
                    if (activeAnsiCodes.length > 0) {
                        currentLine += "\u001B[0m";
                    }
                    wrappedLines.push(currentLine.trimEnd());
                    currentLine = activeAnsiCodes.join("");
                    currentLineWidth = 0;
                }

                let charPos = 0;
                while (charPos < word.length) {
                    const char = word[charPos];
                    const charWidth = stringWidth(char);

                    if (currentLineWidth + charWidth > maxWidth) {
                        if (activeAnsiCodes.length > 0) {
                            currentLine += "\u001B[0m";
                        }
                        wrappedLines.push(currentLine.trimEnd());
                        currentLine = activeAnsiCodes.join("");
                        currentLineWidth = 0;
                    }

                    currentLine += char;
                    currentLineWidth += charWidth;
                    charPos++;
                }
            } else if (currentLineWidth + (currentLineWidth > 0 ? 1 : 0) + wordWidth > maxWidth) {
                // Word doesn't fit on current line
                if (activeAnsiCodes.length > 0) {
                    currentLine += "\u001B[0m";
                }
                wrappedLines.push(currentLine.trimEnd());
                currentLine = activeAnsiCodes.join("") + word;
                currentLineWidth = wordWidth;
            } else {
                // Word fits on current line
                if (currentLineWidth > 0) {
                    currentLine += " ";
                    currentLineWidth += 1;
                }
                currentLine += word;
                currentLineWidth += wordWidth;
            }

            position += word.length + 1; // +1 for the space
        }

        // Add the last line if there's anything left
        if (currentLine) {
            if (activeAnsiCodes.length > 0) {
                currentLine += "\u001B[0m";
            }
            wrappedLines.push(currentLine.trimEnd());
        }
    }

    return wrappedLines;
};
