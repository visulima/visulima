import { ANSI_ESCAPE_BELL, ANSI_ESCAPE_LINK, ESCAPES } from "../constants";
import readControlSequence from "./read-control-sequence";
import type { AnsiSegment, HyperlinkSegment, ProcessAnsiStringOptions } from "./types";

/**
 * Checks if a character is inside an ANSI escape sequence.
 * @param chars Array of characters
 * @param index Current index
 * @returns Object with isInsideEscape and isInsideLinkEscape flags
 */
const checkEscapeSequence = (
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

/**
 * Counts a sequence's length in code points, matching the unit the scan loop advances in.
 * @param sequence The sequence to measure.
 * @returns Its length in code points.
 */
const codePointLength = (sequence: string): number => {
    let count = 0;

    for (let index = 0; index < sequence.length; index += 1) {
        // Surrogate pairs are two UTF-16 units but one code point; skip the low half.
        if ((sequence.codePointAt(index) as number) > 0xFF_FF) {
            index += 1;
        }

        count += 1;
    }

    return count;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const processAnsiString = (string: string, options: ProcessAnsiStringOptions = {}): void => {
    let currentText = "";
    let isInsideEscape = false;
    let escapeStart = 0;
    let escapeBuffer = "";
    let currentUrl = "";
    let isInHyperlink = false;

    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: Unicode code point splitting needed for character-by-character ANSI parsing
    const chars = [...string];

    // The loop counts in code points; `readControlSequence` indexes the raw string in UTF-16 units.
    // A single astral character ahead of an escape puts the two out of step, the sequence reads as
    // truncated, and everything after it collapses into one zero-width escape segment — which then
    // drops out of width accounting in the wrapping paths. Map each code-point index to its UTF-16
    // offset once, so every jump the loop makes stays translatable.
    const unitOffsets = new Array<number>(chars.length);

    for (let cursor = 0, units = 0; cursor < chars.length; cursor += 1) {
        unitOffsets[cursor] = units;
        units += (chars[cursor] as string).length;
    }

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

                if (options.onSegment?.(segment) === false) {
                    return;
                }

                // eslint-disable-next-line sonarjs/no-redundant-assignments
                currentText = "";
            }

            isInsideEscape = true;
            escapeStart = index;
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

                if (options.onSegment?.(segment) === false) {
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

                if (options.onSegment?.(segment) === false) {
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
            // Read the whole sequence rather than waiting for an "m": a non-SGR sequence such as
            // CSI 1 D has a different final byte, and scanning for "m" swallowed the rest of the
            // string into the escape buffer.
            const sequence = readControlSequence(string, unitOffsets[escapeStart] as number);

            isInsideEscape = false;

            if (sequence === undefined) {
                // Truncated at the end of the input: emit the remainder as one incomplete escape
                // rather than letting the loop re-read its bytes as text.
                escapeBuffer = chars.slice(escapeStart).join("");
                // eslint-disable-next-line sonarjs/updated-loop-counter
                index = chars.length;
            } else {
                escapeBuffer = sequence;
                // Continue after the sequence. `index++` in the loop header moves past the last byte.
                // eslint-disable-next-line sonarjs/updated-loop-counter
                index = escapeStart + codePointLength(sequence) - 1;
            }

            const segment: AnsiSegment = {
                isEscapeSequence: true,
                isGrapheme: false,
                text: escapeBuffer,
                width: 0,
            };

            if (options.onSegment?.(segment) === false) {
                return;
            }

            escapeBuffer = "";

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

        if (options.onSegment?.(segment) === false) {
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

        options.onSegment?.(segment);
    }

    // Handle any incomplete escape sequence
    if (escapeBuffer) {
        const segment: AnsiSegment = {
            isEscapeSequence: true,
            isGrapheme: false,
            text: escapeBuffer,
            width: 0,
        };

        options.onSegment?.(segment);
    }
};

export { checkEscapeSequence };
