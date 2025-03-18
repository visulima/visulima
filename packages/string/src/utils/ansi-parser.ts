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
// eslint-disable-next-line sonarjs/cognitive-complexity
export const processAnsiString = (string: string, options: ProcessAnsiStringOptions = {}): void => {
    const stateTracker = new AnsiStateTracker();

    let currentText = "";
    let isInsideEscape = false;
    let isInsideLinkEscape = false;
    let escapeBuffer = "";
    let currentUrl = "";
    let isInHyperlink = false;
    let textIndex = 0;
    let visualIndex = 0;

    const chars = [...string];

    // eslint-disable-next-line no-plusplus,no-loops/no-loops
    for (let index = 0; index < chars.length; index++) {
        const character = chars[index] as string;

        // Handle escape sequences
        if (character && ESCAPES.has(character)) {
            // If we have pending text, emit it as a segment
            if (currentText) {
                const width = options.getWidth?.(currentText) ?? 0;
                const textStart = textIndex - currentText.length;
                const textEnd = textIndex;

                const segment: AnsiSegment | HyperlinkSegment = {
                    isEscapeSequence: false,
                    isGrapheme: true,
                    text: currentText,
                    textEnd,
                    textStart,
                    visualEnd: visualIndex,
                    visualStart: visualIndex - width,
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
            // eslint-disable-next-line no-plusplus
            textIndex++;

            // Check for hyperlink sequence
            const escapeInfo = checkEscapeSequence(chars, index);
            isInsideLinkEscape = escapeInfo.isInsideLinkEscape;

            if (isInsideLinkEscape) {
                // Extract URL from hyperlink sequence
                let urlEnd = index + 1;
                currentUrl = "";

                // eslint-disable-next-line no-loops/no-loops
                while (urlEnd < chars.length) {
                    const nextChar = chars[urlEnd] as string;

                    if (nextChar === ANSI_ESCAPE_BELL) {
                        break;
                    }

                    currentUrl += nextChar;
                    // eslint-disable-next-line no-plusplus
                    urlEnd++;
                    // eslint-disable-next-line no-plusplus
                    textIndex++;
                }

                // Remove the "]8;;" prefix
                currentUrl = currentUrl.slice(4);

                const segment: HyperlinkSegment = {
                    hyperlinkUrl: currentUrl,
                    isEscapeSequence: true,
                    isGrapheme: false,
                    isHyperlink: true,
                    isHyperlinkStart: true,
                    textEnd: textIndex + 1, // +1 to include the bell char
                    textStart: textIndex - escapeBuffer.length - currentUrl.length - 1, // -1 for bell char
                    visualEnd: visualIndex,
                    visualStart: visualIndex,
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
                // eslint-disable-next-line no-plusplus
                textIndex++; // For the bell character

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
                    textEnd: textIndex + 2, // +2 for escape and backslash
                    textStart: textIndex,
                    visualEnd: visualIndex,
                    visualStart: visualIndex,
                    width: 0,
                };

                if (options.onSegment?.(segment, stateTracker) === false) {
                    return;
                }

                isInHyperlink = false;
                currentUrl = "";
                // eslint-disable-next-line no-plusplus
                index++; // Skip the backslash
                // eslint-disable-next-line no-plusplus
                textIndex++; // For the backslash
                isInsideEscape = false;
                escapeBuffer = "";

                // eslint-disable-next-line no-continue
                continue;
            }
        }

        if (isInsideEscape) {
            escapeBuffer += character;
            // eslint-disable-next-line no-plusplus
            textIndex++;

            if (character === ANSI_SGR_TERMINATOR) {
                // End of SGR sequence
                isInsideEscape = false;
                stateTracker.processEscape(escapeBuffer);

                // Determine style information
                // eslint-disable-next-line no-control-regex,regexp/no-control-character
                const styleType = /\u001B\[(\d+)m/.exec(escapeBuffer)?.[1];

                let isCloseStyle = false;
                let isOpenStyle = false;

                if (styleType) {
                    isOpenStyle = !["0", "39", "49"].includes(styleType) && !(Number.parseInt(styleType, 10) >= 21 && Number.parseInt(styleType, 10) <= 29);
                    isCloseStyle = ["0", "39", "49"].includes(styleType) || (Number.parseInt(styleType, 10) >= 21 && Number.parseInt(styleType, 10) <= 29);
                }

                const segment: AnsiSegment = {
                    isCloseStyle,
                    isEscapeSequence: true,
                    isGrapheme: false,
                    isOpenStyle,
                    styleType,
                    text: escapeBuffer,
                    textEnd: textIndex,
                    textStart: textIndex - escapeBuffer.length,
                    visualEnd: visualIndex,
                    visualStart: visualIndex,
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
        // eslint-disable-next-line no-plusplus
        textIndex++;

        // For single-character segments, emit each one separately
        const width = options.getWidth?.(currentText) ?? currentText.length;
        visualIndex += width;
    }

    // Add any remaining text
    if (currentText) {
        const width = options.getWidth?.(currentText) ?? 0;
        const textStart = textIndex - currentText.length;
        const textEnd = textIndex;

        const segment: AnsiSegment | HyperlinkSegment = {
            isEscapeSequence: false,
            isGrapheme: true,
            text: currentText,
            textEnd,
            textStart,
            visualEnd: visualIndex,
            visualStart: visualIndex - width,
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
            textEnd: textIndex,
            textStart: textIndex - escapeBuffer.length,
            visualEnd: visualIndex,
            visualStart: visualIndex,
            width: 0,
        };

        options.onSegment?.(segment, stateTracker);
    }
};
