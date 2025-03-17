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
export const processAnsiString = (string: string, options: ProcessAnsiStringOptions = {}): void => {
    const stateTracker = new AnsiStateTracker();

    let currentText = "";
    let isInsideEscape = false;
    let isInsideLinkEscape = false;
    let escapeBuffer = "";
    let currentUrl = "";
    let isInHyperlink = false;

    const chars = [...string];
    // eslint-disable-next-line no-loops/no-loops
    for (let i = 0; i < chars.length; i++) {
        const character = chars[i];

        // Handle escape sequences
        if (character && ESCAPES.has(character)) {
            // If we have pending text, emit it as a segment
            if (currentText) {
                const width = options.getWidth?.(currentText) ?? 0;
                const segment: (AnsiSegment | HyperlinkSegment) = {
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
            const escapeInfo = checkEscapeSequence(chars, i);
            isInsideLinkEscape = escapeInfo.isInsideLinkEscape;

            if (isInsideLinkEscape) {
                // Extract URL from hyperlink sequence
                let urlEnd = i + 1;
                currentUrl = "";

                while (urlEnd < chars.length) {
                    const nextChar = chars[urlEnd];

                    if (nextChar === ANSI_ESCAPE_BELL) {
                        break;
                    }

                    currentUrl += nextChar;
                    urlEnd++;
                }

                // Remove the "]8;;" prefix
                currentUrl = currentUrl.slice(4);

                const segment: HyperlinkSegment = {
                    isEscapeSequence: true,
                    isGrapheme: false,
                    isHyperlink: true,
                    isHyperlinkStart: true,
                    hyperlinkUrl: currentUrl,
                    width: 0,
                };

                if (options.onSegment?.(segment, stateTracker) === false) {
                    return;
                }

                i = urlEnd;
                isInHyperlink = true;
                isInsideEscape = false;
                isInsideLinkEscape = false;
                escapeBuffer = "";
                continue;
            }

            // Check for hyperlink end sequence: \u001B\\
            if (i + 1 < chars.length && chars[i + 1] === "\\") {
                if (isInHyperlink) {
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
                    i++; // Skip the backslash
                    isInsideEscape = false;
                    escapeBuffer = "";
                    continue;
                }
            }
        }

        if (isInsideEscape) {
            escapeBuffer += character;

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

        // Accumulate regular characters
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