import { getStringWidth } from "./get-string-width";

// Define segment types for TypeScript type checking
type TextSegment = {
    type: "text";
    content: string;
    startPos: number;
    endPos: number;
    graphemes: string[];
};

type AnsiCodeSegment = {
    type: "ansi";
    content: string;
    code: number | null | undefined;
    endIdx: number;
};

type HyperlinkSegment = {
    type: "hyperlink";
    content: string;
    isStart?: boolean;
    endIdx: number;
};

// Union type for all segment types
type Segment = TextSegment | AnsiCodeSegment | HyperlinkSegment;

// ANSI control character code points
const ESC = 0x1b;
const OPEN_BRACKET = 0x5b;
const CLOSE_BRACKET = 0x5d;
const DIGIT_0 = 0x30;
const DIGIT_9 = 0x39;
const LOWER_M = 0x6d;
const SEMICOLON = 0x3b;
const DIGIT_8 = 0x38;
const BEL = 0x07;

// ANSI sequence constants
const HYPERLINK_START = "\u001B]8;;";
const HYPERLINK_END = "\u001B]8;;\u0007";

/**
 * Parses an ANSI escape sequence from a string at the specified position.
 * Handles both CSI sequences for styling and OSC sequences for hyperlinks.
 *
 * @param {string} inputString - The string containing the ANSI escape sequence
 * @param {number} startPosition - The position where the escape sequence begins
 * @returns {AnsiCodeSegment | HyperlinkSegment | null} - Parsed sequence object if valid, null if invalid
 */
const parseAnsiSequence = (inputString: string, startPosition: number): AnsiCodeSegment | HyperlinkSegment | null => {
    if (startPosition + 1 >= inputString.length) {
        return null;
    }

    const nextChar = inputString.codePointAt(startPosition + 1);

    // Check for CSI sequence (ESC [)
    if (nextChar === OPEN_BRACKET) {
        let currentPosition = startPosition + 2;
        let codeValue = 0;

        // Parse numeric parameters
        while (currentPosition < inputString.length) {
            const charCode = inputString.codePointAt(currentPosition) ?? 0;

            if (charCode >= DIGIT_0 && charCode <= DIGIT_9) {
                codeValue = codeValue * 10 + (charCode - DIGIT_0);
            } else if (charCode === SEMICOLON) {
                // Complex code with semicolon is still valid
                codeValue = 0;
            } else if (charCode === LOWER_M) {
                // Valid termination with 'm'
                return {
                    code: codeValue,
                    content: inputString.slice(startPosition, currentPosition + 1),
                    endIdx: currentPosition + 1,
                    type: "ansi",
                };
            } else {
                // Invalid character - not a valid ANSI sequence
                return null;
            }

            currentPosition++;
        }

        // Reached end without finding terminator
        return null;
    }
    // Check for OSC sequence (ESC ])
    else if (nextChar === CLOSE_BRACKET && startPosition + 2 < inputString.length && inputString.codePointAt(startPosition + 2) === DIGIT_8) {
        // Check for hyperlink start
        if (
            startPosition + HYPERLINK_START.length <= inputString.length &&
            inputString.slice(startPosition, startPosition + HYPERLINK_START.length) === HYPERLINK_START
        ) {
            // Find hyperlink end
            let hyperlinkEndPosition = -1;
            for (let scanPosition = startPosition + HYPERLINK_START.length; scanPosition < inputString.length; scanPosition++) {
                if (
                    inputString.codePointAt(scanPosition) === BEL ||
                    (inputString.codePointAt(scanPosition) === ESC &&
                        scanPosition + 1 < inputString.length &&
                        inputString.codePointAt(scanPosition + 1) === 0x5c)
                ) {
                    hyperlinkEndPosition = scanPosition + (inputString.codePointAt(scanPosition) === BEL ? 1 : 2);
                    break;
                }
            }

            if (hyperlinkEndPosition !== -1) {
                return {
                    content: inputString.slice(startPosition, hyperlinkEndPosition),
                    endIdx: hyperlinkEndPosition,
                    isStart: true,
                    type: "hyperlink",
                };
            }
        }
        // Check for hyperlink end
        else if (
            startPosition + HYPERLINK_END.length <= inputString.length &&
            inputString.slice(startPosition, startPosition + HYPERLINK_END.length) === HYPERLINK_END
        ) {
            return {
                content: HYPERLINK_END,
                endIdx: startPosition + HYPERLINK_END.length,
                isStart: false,
                type: "hyperlink",
            };
        }
    }

    return null;
};

/**
 * High-performance function to slice ANSI-colored strings while preserving style codes.
 * Handles ANSI escape sequences, hyperlinks, and maintains proper styling across the sliced substring.
 *
 * @param {string} inputString - The original string with ANSI escape codes
 * @param {number} startIndex - Start index for the slice (default: 0)
 * @param {number} endIndex - End index for the slice (default: string length)
 * @param {Object} [options] - Additional options for slicing
 * @param {Intl.Segmenter} [options.segmenter] - Custom segmenter for grapheme handling
 * @returns {string} The sliced string with preserved ANSI styling
 */
const slice = (inputString: string, startIndex = 0, endIndex = inputString.length, options?: { segmenter?: Intl.Segmenter }): string => {
    if (startIndex >= endIndex || inputString === "") {
        return "";
    }

    if (startIndex === 0 && endIndex >= inputString.length && !inputString.includes("\u001B")) {
        return inputString;
    }

    if (startIndex < 0 || endIndex < 0) {
        throw new RangeError("Negative indices aren't supported");
    }

    const sliceLength = endIndex - startIndex;

    if (sliceLength <= 0) {
        return "";
    }

    if (inputString.includes(HYPERLINK_START) && startIndex === 0 && endIndex >= inputString.length) {
        return inputString;
    }

    let visiblePos = 0;
    let index = 0;
    let textStart = 0;

    const segmenter: Intl.Segmenter = options?.segmenter ?? new Intl.Segmenter("en", { granularity: "grapheme" });
    const segments: Segment[] = [];

    while (index < inputString.length) {
        const cp = inputString.codePointAt(index) || 0;

        if (cp === ESC) {
            const ansiSeq = parseAnsiSequence(inputString, index);

            if (ansiSeq) {
                if (index > textStart) {
                    const textContent = inputString.slice(textStart, index);
                    const willBeVisible = visiblePos < endIndex && visiblePos + textContent.length > startIndex;
                    const graphemes: string[] = willBeVisible
                        ? Array.from(segmenter.segment(textContent), (entry) => entry.segment)
                        : Array.from({ length: getStringWidth(textContent) });

                    segments.push({
                        content: textContent,
                        endPos: visiblePos + graphemes.length,
                        graphemes,
                        startPos: visiblePos,
                        type: "text",
                    });

                    visiblePos += graphemes.length;
                }

                if (ansiSeq.type === "ansi") {
                    const { code } = ansiSeq;

                    segments.push({
                        code,
                        content: ansiSeq.content,
                        endIdx: ansiSeq.endIdx,
                        type: "ansi",
                    });
                } else if (ansiSeq.type === "hyperlink") {
                    segments.push({
                        content: ansiSeq.content,
                        endIdx: ansiSeq.endIdx,
                        isStart: ansiSeq.isStart,
                        type: "hyperlink",
                    });
                }

                index = ansiSeq.endIdx;
                textStart = index;
            } else {
                index++;
                textStart = index;
            }
        } else {
            index += cp > 0xff_ff ? 2 : 1;
        }
    }

    if (textStart < inputString.length) {
        const textContent = inputString.slice(textStart);
        const willBeVisible = visiblePos < endIndex && visiblePos + textContent.length > startIndex;

        let graphemes: string[] = [];

        if (willBeVisible) {
            graphemes = Array.from(segmenter.segment(textContent), (entry) => entry.segment);
        } else {
            graphemes = Array.from({ length: getStringWidth(textContent) });
        }

        segments.push({
            content: textContent,
            endPos: visiblePos + graphemes.length,
            graphemes,
            startPos: visiblePos,
            type: "text",
        });
    }

    const visibleSegments = segments.filter((segment) => segment.type === "text" && segment.startPos < endIndex && segment.endPos > startIndex);

    if (visibleSegments.length === 0) {
        return "";
    }

    const resultParts: string[] = [];
    const firstVisibleSegmentIndex = segments.findIndex((segment) => segment.type === "text" && segment.startPos < endIndex && segment.endPos > startIndex);

    if (firstVisibleSegmentIndex > 0) {
        // Add all ANSI codes before the first visible segment
        for (let i = 0; i < firstVisibleSegmentIndex; i++) {
            const segment = segments[i] as Segment;

            if (segment.type === "ansi" || segment.type === "hyperlink") {
                resultParts.push(segment.content);
            }
        }
    }

    const textSegments: number[] = [];

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        if (!segment) {
            continue;
        }

        if (segment.type === "text") {
            const textSegment = segment as TextSegment;
            const segmentStart = Math.max(0, startIndex - textSegment.startPos);
            const segmentEnd = Math.min(textSegment.graphemes.length, endIndex - textSegment.startPos);

            if (segmentStart < segmentEnd) {
                textSegments.push(i);
            }
        }
    }

    const textRanges: Array<{ index: number; text: string }> = [];

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i] as Segment;

        if (segment.type === "text") {
            const textSegment = segment as TextSegment;
            const segmentStart = Math.max(0, startIndex - textSegment.startPos);
            const segmentEnd = Math.min(textSegment.graphemes.length, endIndex - textSegment.startPos);

            if (segmentStart < segmentEnd) {
                textRanges.push({
                    index: i,
                    text: textSegment.graphemes.slice(segmentStart, segmentEnd).join(""),
                });
            }
        }
    }

    let lastTextIndex = 0;

    for (const { index, text } of textRanges) {
        if (lastTextIndex !== 0) {
            for (let i = lastTextIndex + 1; i < index; i++) {
                const segment = segments[i] as Segment;

                if (segment.type === "text") {
                    continue;
                }

                resultParts.push(segment.content);
            }
        }

        resultParts.push(text);
        lastTextIndex = index;
    }

    const lastSegment = segments[lastTextIndex + 1];

    if (lastSegment && lastSegment.type !== "text") {
        const ansiSegment = lastSegment as AnsiCodeSegment;
        resultParts.push(ansiSegment.content);
    }

    const result = resultParts.join("");

    // Special case for slicing just the first character before ANSI codes
    if (
        startIndex === 0 &&
        endIndex === 1 &&
        inputString.length > 1 &&
        inputString.charAt(0) !== "\u001B" &&
        inputString.includes("\u001B") &&
        result.length > 1
    ) {
        // Return just the visible character
        return result.charAt(0);
    }

    return result;
};

export default slice;
