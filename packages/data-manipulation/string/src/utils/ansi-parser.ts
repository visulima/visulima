import { ANSI_ESCAPE_BELL, ANSI_ESCAPE_LINK, ANSI_SGR_TERMINATOR, ESCAPES } from "../constants";
import AnsiStateTracker from "./ansi-state-tracker";
import type { AnsiSegment, HyperlinkSegment, ProcessAnsiStringOptions } from "./types";

/**
 * Checks if a character is inside an ANSI escape sequence.
 * @param chars Array of characters
 * @param index Current index
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
 * Processes a string with ANSI escape codes character by character.
 * @param string The string to process
 * @param options Processing options
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const processAnsiString = (string: string, options: ProcessAnsiStringOptions = {}): void => {
    const stateTracker = new AnsiStateTracker();

    let currentText = "";
    let isInsideEscape = false;
    let escapeBuffer = "";
    let currentUrl = "";
    let isInHyperlink = false;

    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: Unicode code point splitting needed for character-by-character ANSI parsing
    const chars = [...string];

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < chars.length; index++) {
        const character = chars[index] as string;

        if (character && ESCAPES.has(character)) {
            // If we have pending text, emit it as a segment
            if (currentText) {
                const width = options.getWidth?.(currentText) ?? 0;
                const segment: AnsiSegment | HyperlinkSegment = {
                    isEscapeSequence: false,
                    isGrapheme: true,
                    text: currentText,
                    width,
                };

                // If we're inside a hyperlink, add the link info to the segment
                if (isInHyperlink) {
                    (segment as HyperlinkSegment).isHyperlink = true;
                    (segment as HyperlinkSegment).hyperlinkUrl = currentUrl;
                }

                if (options.onSegment?.(segment, stateTracker) === false) {
                    return;
                }

                // eslint-disable-next-line sonarjs/no-redundant-assignments
                currentText = "";
            }

            isInsideEscape = true;
            escapeBuffer = character;

            // Check for hyperlink sequence
            const escapeInfo = checkEscapeSequence(chars, index);

            const { isInsideLinkEscape } = escapeInfo;

            if (isInsideLinkEscape) {
                // Extract URL from hyperlink sequence
                let urlEnd = index + 1;

                currentUrl = "";

                while (urlEnd < chars.length) {
                    const nextChar = chars[urlEnd] as string;

                    if (nextChar === ANSI_ESCAPE_BELL) {
                        break;
                    }

                    currentUrl += nextChar;

                    urlEnd += 1;
                }

                // Remove the "]8;;" prefix
                currentUrl = currentUrl.slice(4);

                const segment: HyperlinkSegment = {
                    hyperlinkUrl: currentUrl,
                    isEscapeSequence: true,
                    isGrapheme: false,
                    isHyperlink: true,
                    isHyperlinkStart: true,
                    width: 0,
                };

                if (options.onSegment?.(segment, stateTracker) === false) {
                    return;
                }

                // eslint-disable-next-line sonarjs/updated-loop-counter
                index = urlEnd;
                isInHyperlink = true;
                isInsideEscape = false;
                escapeBuffer = "";

                continue;
            }

            // Check for hyperlink end sequence: \u001B\\
            if (index + 1 < chars.length && chars[index + 1] === "\\" && isInHyperlink) {
                const segment: HyperlinkSegment = {
                    isEscapeSequence: true,
                    isGrapheme: false,
                    isHyperlink: true,
                    isHyperlinkEnd: true,
                    width: 0,
                };

                if (options.onSegment?.(segment, stateTracker) === false) {
                    return;
                }

                isInHyperlink = false;
                currentUrl = "";

                index += 1; // Skip the backslash
                isInsideEscape = false;
                escapeBuffer = "";

                continue;
            }
        }

        if (isInsideEscape) {
            if (escapeBuffer !== character) {
                escapeBuffer += character;
            }

            if (character === ANSI_SGR_TERMINATOR) {
                // End of SGR sequence
                isInsideEscape = false;
                stateTracker.processEscape(escapeBuffer);

                const segment: AnsiSegment = {
                    isEscapeSequence: true,
                    isGrapheme: false,
                    text: escapeBuffer,
                    width: 0,
                };

                if (options.onSegment?.(segment, stateTracker) === false) {
                    return;
                }

                escapeBuffer = "";
            }

            continue;
        }

        currentText += character;

        // Emit each character as a separate segment, matching the original behavior
        const width = options.getWidth?.(currentText) ?? 0;
        const segment: AnsiSegment | HyperlinkSegment = {
            isEscapeSequence: false,
            isGrapheme: true,
            text: currentText,
            width,
        };

        // If we're inside a link, add the link info to the segment
        if (isInHyperlink) {
            (segment as HyperlinkSegment).isHyperlink = true;
            (segment as HyperlinkSegment).hyperlinkUrl = currentUrl;
        }

        if (options.onSegment?.(segment, stateTracker) === false) {
            return;
        }

        currentText = "";
    }

    // Add any remaining text
    if (currentText) {
        const width = options.getWidth?.(currentText) ?? 0;
        const segment: AnsiSegment | HyperlinkSegment = {
            isEscapeSequence: false,
            isGrapheme: true,
            text: currentText,
            width,
        };

        if (isInHyperlink) {
            (segment as HyperlinkSegment).isHyperlink = true;
            (segment as HyperlinkSegment).hyperlinkUrl = currentUrl;
        }

        options.onSegment?.(segment, stateTracker);
    }

    // Handle any incomplete escape sequence
    if (escapeBuffer) {
        const segment: AnsiSegment = {
            isEscapeSequence: true,
            isGrapheme: false,
            text: escapeBuffer,
            width: 0,
        };

        options.onSegment?.(segment, stateTracker);
    }
};
