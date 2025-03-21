import { ANSI_ESCAPE_BELL, ANSI_ESCAPE_LINK, ANSI_SGR_TERMINATOR, ESCAPES } from "../constants";
import AnsiStateTracker from "./ansi-state-tracker";
import type { AnsiSegment, HyperlinkSegment, ProcessAnsiStringOptions } from "./types";

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
    // eslint-disable-next-line security/detect-object-injection
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
    let currentUrl = "";
    let isInHyperlink = false;

    const chars = [...string];
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < chars.length; index++) {
        // eslint-disable-next-line security/detect-object-injection
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

                currentText = "";
            }

            isInsideEscape = true;
            escapeBuffer = character;

            // Check for hyperlink sequence
            const escapeInfo = checkEscapeSequence(chars, index);
            isInsideLinkEscape = escapeInfo.isInsideLinkEscape;

            if (isInsideLinkEscape) {
                // Extract URL from hyperlink sequence
                let urlEnd = index + 1;
                currentUrl = "";

                while (urlEnd < chars.length) {
                    // eslint-disable-next-line security/detect-object-injection
                    const nextChar = chars[urlEnd] as string;

                    if (nextChar === ANSI_ESCAPE_BELL) {
                        break;
                    }

                    currentUrl += nextChar;
                    // eslint-disable-next-line no-plusplus
                    urlEnd++;
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

                index = urlEnd;
                isInHyperlink = true;
                isInsideEscape = false;
                isInsideLinkEscape = false;
                escapeBuffer = "";

                // eslint-disable-next-line no-continue
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
                // eslint-disable-next-line no-plusplus
                index++; // Skip the backslash
                isInsideEscape = false;
                escapeBuffer = "";
                // eslint-disable-next-line no-continue
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
            // eslint-disable-next-line no-continue
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
