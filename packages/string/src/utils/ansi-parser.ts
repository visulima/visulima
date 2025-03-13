import { ANSI_ESCAPE_BELL, ANSI_ESCAPE_LINK, ANSI_SGR_TERMINATOR, ESCAPES } from "../constants";
import AnsiStateTracker from "./ansi-state-tracker";
import type { AnsiSegment, ProcessAnsiStringOptions } from "./types";

/**
 * Helper function to check if a character is inside an ANSI escape sequence
 * @param chars - Array of characters
 * @param index - Current index
 * @returns Object with isInsideEscape and isInsideLinkEscape flags
 */
export const checkEscapeSequence = (
    chars: string[],
    index: number,
): {
    isInsideEscape: boolean;
    isInsideLinkEscape: boolean;
} => {
    if (!ESCAPES.has(chars[index] as string)) {
        return { isInsideEscape: false, isInsideLinkEscape: false };
    }

    const isInsideEscape = true;
    // Check for link escape sequence
    const possibleLink = chars.slice(index + 1, index + 1 + ANSI_ESCAPE_LINK.length).join("");
    const isInsideLinkEscape = possibleLink === ANSI_ESCAPE_LINK;

    return { isInsideEscape, isInsideLinkEscape };
};

/**
 * Process a string with ANSI escape codes character by character
 * @param string - The string to process
 * @param options - Processing options
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const processAnsiString = (string: string, options: ProcessAnsiStringOptions = {}): void => {
    const stateTracker = new AnsiStateTracker();
    let currentText = "";
    let isInsideEscape = false;
    let isInsideLinkEscape = false;
    let escapeBuffer = "";

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const [index, character] of [...string].entries()) {
        // Handle escape sequences
        if (ESCAPES.has(character)) {
            isInsideEscape = true;
            escapeBuffer = character;

            // Add any pending text as a segment
            if (currentText) {
                const width = options.getWidth?.(currentText) ?? 0;
                const segment: AnsiSegment = {
                    codes: [stateTracker.getActiveEscapes()].filter(Boolean),
                    isEscapeSequence: false,
                    isGrapheme: true,
                    text: currentText,
                    width,
                };

                if (options.onSegment?.(segment, stateTracker) === false) {
                    return;
                }

                if (options.onGrapheme && options.onGrapheme(currentText, width, stateTracker) === false) {
                    return;
                }

                currentText = "";
            }

            // Check for hyperlink sequence
            const chars = [...string];
            const escapeInfo = checkEscapeSequence(chars, index);
            isInsideLinkEscape = escapeInfo.isInsideLinkEscape;
            currentText += character;
            // eslint-disable-next-line no-continue
            continue;
        }

        if (isInsideEscape) {
            escapeBuffer += character;
            currentText += character;

            if (isInsideLinkEscape) {
                if (character === ANSI_ESCAPE_BELL) {
                    // End of hyperlink
                    // eslint-disable-next-line no-multi-assign
                    isInsideEscape = isInsideLinkEscape = false;
                    const segment: AnsiSegment = {
                        codes: [],
                        isEscapeSequence: true,
                        isGrapheme: false,
                        text: currentText,
                        width: 0,
                    };

                    if (options.onSegment?.(segment, stateTracker) === false) {
                        return;
                    }

                    if (options.onEscapeSequence && options.onEscapeSequence(currentText, stateTracker) === false) {
                        return;
                    }

                    currentText = "";
                }
            } else if (character === ANSI_SGR_TERMINATOR) {
                // End of SGR sequence
                isInsideEscape = false;
                stateTracker.processEscape(escapeBuffer);

                const segment: AnsiSegment = {
                    codes: [],
                    isEscapeSequence: true,
                    isGrapheme: false,
                    text: currentText,
                    width: 0,
                };

                if (options.onSegment?.(segment, stateTracker) === false) {
                    return;
                }

                if (options.onEscapeSequence && options.onEscapeSequence(currentText, stateTracker) === false) {
                    return;
                }

                currentText = "";
            }
            // eslint-disable-next-line no-continue
            continue;
        }

        // Handle regular characters
        currentText += character;
        const width = options.getWidth?.(currentText) ?? 0;

        const segment: AnsiSegment = {
            codes: [stateTracker.getActiveEscapes()].filter(Boolean),
            isEscapeSequence: false,
            isGrapheme: true,
            text: currentText,
            width,
        };

        if (options.onSegment?.(segment, stateTracker) === false) {
            return;
        }

        if (options.onGrapheme && options.onGrapheme(currentText, width, stateTracker) === false) {
            return;
        }

        currentText = "";
    }

    // Add any remaining text
    if (currentText) {
        const width = options.getWidth?.(currentText) ?? 0;
        const segment: AnsiSegment = {
            codes: [stateTracker.getActiveEscapes()].filter(Boolean),
            isEscapeSequence: false,
            isGrapheme: true,
            text: currentText,
            width,
        };

        options.onSegment?.(segment, stateTracker);

        if (options.onGrapheme) {
            options.onGrapheme(currentText, width, stateTracker);
        }
    }
};
