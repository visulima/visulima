import stringWidth from "string-width";

import type { TruncateOptions } from "../types";
import { findRealPosition } from "./find-real-position";
import { getIndexOfNearestSpace } from "./get-index-of-nearest-space";
import { preserveAnsiCodes } from "./preserve-ansi-codes";

/** Truncates text to a specified width, handling ANSI codes. */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const truncateText = (text: string, maxWidth: number, options: Required<TruncateOptions>): string => {
    if (maxWidth < 1) {
        return "";
    }

    if (maxWidth === 1) {
        return options.truncationCharacter;
    }

    const lines = text.split("\n");
    const { truncationCharacter } = options;

    const truncatedLines = lines.map((line) => {
        const lineLength = stringWidth(line);

        if (lineLength <= maxWidth) {
            return line;
        }

        const truncCharWidth = stringWidth(truncationCharacter);

        // Calculate effective width based on position
        let effectiveMaxWidth = maxWidth - truncCharWidth;

        if (options.space) {
            effectiveMaxWidth -= 1;
        }

        const parseAnsiString = (string_: string) => {
            const result = [];

            let currentText = "";
            let currentAnsi = "";
            let inAnsi = false;

            for (const element of string_) {
                if (element === "\u001B") {
                    if (currentText) {
                        result.push({ content: currentText, type: "text" });
                        currentText = "";
                    }

                    inAnsi = true;
                    currentAnsi = element;
                } else if (inAnsi) {
                    currentAnsi += element;

                    if (element === "m") {
                        result.push({ content: currentAnsi, type: "ansi" });
                        currentAnsi = "";
                        inAnsi = false;
                    }
                } else {
                    currentText += element;
                }
            }

            if (currentText) {
                result.push({ content: currentText, type: "text" });
            }

            return result;
        };

        const findSpacePosition = (string_: string, maxPos: number, fromStart: boolean) => {
            const parts = parseAnsiString(string_);
            let currentWidth = 0;
            let lastSpacePos = -1;
            let textPos = 0;
            let totalText = "";

            for (const part of parts) {
                if (part.type === "text") {
                    const chars = fromStart ? part.content.split("") : part.content.split("").reverse();
                    for (const char of chars) {
                        const charWidth = stringWidth(char);

                        if (currentWidth + charWidth > maxPos) {
                            return lastSpacePos === -1 ? textPos : lastSpacePos;
                        }

                        if (char === " ") {
                            lastSpacePos = totalText.length;
                        }
                        totalText += char;
                        currentWidth += charWidth;
                        textPos++;
                    }
                }
            }

            return lastSpacePos;
        };

        const truncateToWidth = (string_: string, width: number, fromStart = true) => {
            if (width <= 0) {
                return "";
            }

            const parts = parseAnsiString(string_);
            let result = "";
            let currentWidth = 0;
            let activeAnsiCodes = [];

            if (options.preferTruncationOnSpace) {
                const spacePos = findSpacePosition(string_, width, fromStart);
                if (spacePos !== -1) {
                    width = spacePos;
                }
            }

            let totalText = "";
            let ansiStack = [];

            for (const part of parts) {
                if (part.type === "ansi") {
                    if (part.content.includes("[0m")) {
                        activeAnsiCodes = [];
                        ansiStack = [];
                    } else if (part.content.includes("[39m")) {
                        activeAnsiCodes = activeAnsiCodes.filter((code) => !code.includes("[3"));
                        ansiStack = ansiStack.filter((code) => !code.includes("[3"));
                    } else {
                        activeAnsiCodes.push(part.content);
                        ansiStack.push(part.content);
                    }
                    result += part.content;
                } else {
                    let chars = part.content.split("");
                    if (!fromStart) {
                        chars = chars.reverse();
                    }

                    for (let index = 0; index < chars.length && currentWidth < width; index++) {
                        const char = chars[index];
                        const charWidth = stringWidth(char);

                        if (currentWidth + charWidth > width) {
                            break;
                        }

                        totalText += char;
                        result += char;
                        currentWidth += charWidth;
                    }
                }
            }

            // Reset ANSI codes
            if (ansiStack.length > 0) {
                result += "\u001B[0m";
            }

            // Restore active codes
            for (const code of activeAnsiCodes) {
                result += code;
            }

            if (!fromStart) {
                // For start position, we need to reverse both the text and the ANSI codes
                const parts = parseAnsiString(result);
                let reversed = "";
                const textParts = [];
                const ansiParts = [];

                for (const part of parts) {
                    if (part.type === "text") {
                        textParts.push(part.content);
                    } else {
                        ansiParts.push(part.content);
                    }
                }

                const reversedText = [...textParts.join("")].reverse().join("");
                reversed = reversedText;

                // Add ANSI codes back
                if (ansiParts.length > 0) {
                    reversed = ansiParts.join("") + reversed;
                }

                return reversed;
            }

            return result;
        };

        let truncated = "";

        if (options.position === "start") {
            const startWidth = effectiveMaxWidth;

            truncated = truncateToWidth(line, startWidth, false);

            return options.space ? `${truncationCharacter} ${truncated}` : truncationCharacter + truncated;
        }

        if (options.position === "middle") {
            // Calculate widths for each half, accounting for truncation character and spaces
            const halfWidth = Math.floor(effectiveMaxWidth / 2);
            const remainingWidth = effectiveMaxWidth - halfWidth;

            // Find the middle point in the text, considering ANSI codes
            const textParts = parseAnsiString(line);
            const textOnlyContent = textParts
                .filter((p) => p.type === "text")
                .map((p) => p.content)
                .join("");
            const midPoint = Math.floor(textOnlyContent.length / 2);

            // Split text at the middle point while preserving ANSI codes
            let currentPos = 0;
            let firstHalf = "";
            let secondHalf = "";
            let activeAnsiCodes = [];

            for (const part of textParts) {
                if (part.type === "ansi") {
                    if (part.content.includes("[0m")) {
                        activeAnsiCodes = [];
                    } else if (!part.content.includes("[39m")) {
                        activeAnsiCodes.push(part.content);
                    }
                    if (currentPos < midPoint) {
                        firstHalf += part.content;
                    } else {
                        secondHalf += part.content;
                    }
                } else if (currentPos + part.content.length <= midPoint) {
                    firstHalf += part.content;
                    currentPos += part.content.length;
                } else if (currentPos >= midPoint) {
                    secondHalf += part.content;
                } else {
                    const splitPoint = midPoint - currentPos;
                    firstHalf += part.content.slice(0, splitPoint);
                    secondHalf += part.content.slice(splitPoint);
                    currentPos = midPoint;
                }
            }

            // Apply ANSI codes to both halves
            secondHalf = activeAnsiCodes.join("") + secondHalf;

            const firstPart = truncateToWidth(firstHalf, halfWidth, true);
            const secondPart = truncateToWidth(secondHalf, remainingWidth, false);

            return options.space ? `${firstPart} ${truncationCharacter} ${secondPart}` : firstPart + truncationCharacter + secondPart;
        }

        // Default: end position
        if (options.preferTruncationOnSpace) {
            const spacePos = findSpacePosition(line, effectiveMaxWidth, true);

            truncated = spacePos === -1 ? truncateToWidth(line, effectiveMaxWidth, true) : truncateToWidth(line, spacePos, true);
        } else {
            truncated = truncateToWidth(line, effectiveMaxWidth, true);
        }

        return options.space ? `${truncated} ${truncationCharacter}` : truncated + truncationCharacter;
    });

    return truncatedLines.join("\n");
};
