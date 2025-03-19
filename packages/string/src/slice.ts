import type { StringWidthOptions } from "./get-string-width";
import { getStringWidth } from "./get-string-width";

const ANSI_REGEX = /\u001B(?:\[(?:\d+(?:;\d+)*)?m|\]8;;.*?(?:\u0007|\u001B\\))/g;

const defaultSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

type StyledSegment = {
    after: string; // ANSI sequences that close styling for this segment
    before: string; // ANSI sequences that apply to this segment
    content: string;
    visibleLength: number;
};

type VisibleSegment = {
    end: number;
    index: number;
    segment: StyledSegment;
    start: number;
};

// Format style type
interface FormatStyle {
    close: string;
    open: string;
}

// Format style with position information
interface FormatStylePosition {
    position: number;
    style: FormatStyle;
}

/**
 * Processes a string with ANSI escape sequences and divides it into styled segments.
 *
 * @param {string} input - String with ANSI escape sequences
 * @param {StringWidthOptions} options - Configuration options for width calculation (default: {})
 * @returns {StyledSegment[]} Array of styled segments with their ANSI styling information
 */
const processIntoStyledSegments = (input: string, options: SliceOptions): StyledSegment[] => {
    // If no ANSI sequences, return a single segment
    if (!input.includes("\u001B")) {
        return [
            {
                after: "",
                before: "",
                content: input,
                visibleLength: getStringWidth(input, options.width),
            },
        ];
    }

    const parts: string[] = input.split(ANSI_REGEX);
    const matches: string[] = Array.from(input.matchAll(ANSI_REGEX), (m) => m[0]);
    const segments: StyledSegment[] = [];
    const openingSequences: string[] = [];
    const closingSequences: string[] = [];

    for (const ansi of matches) {
        if (ansi === "\u001B[0m") {
            closingSequences.push(ansi);
            continue;
        }

        if (ansi === "\u001B]8;;\u0007") {
            closingSequences.push(ansi);
            continue;
        }

        if (ansi.startsWith("\u001B[") && ansi.endsWith("m")) {
            const code = ansi.slice(2, -1);
            if (["0", "22", "23", "24", "27", "28", "29", "39", "49"].includes(code)) {
                closingSequences.push(ansi);
                continue;
            }
        }

        // Otherwise, treat it as an opening sequence
        openingSequences.push(ansi);
    }

    const activeStyles: string[] = [];

    for (const [index, part] of parts.entries()) {
        const text = part as string;

        if (index > 0 && matches[index - 1]) {
            const ansi = matches[index - 1] as string;

            if (ansi === "\u001B[0m") {
                activeStyles.length = 0;
            } else if (ansi === "\u001B]8;;\u0007") {
                const index = activeStyles.findIndex((s) => s.startsWith("\u001B]8;;") && !s.endsWith("\u001B]8;;\u0007"));
                if (index !== -1) {
                    activeStyles.splice(index, 1);
                }
            } else if (ansi.startsWith("\u001B[") && ansi.endsWith("m")) {
                const code = ansi.slice(2, -1);

                if (code === "39") {
                    const index = activeStyles.findIndex((s) => {
                        if (!s.startsWith("\u001B[") || !s.endsWith("m")) 
return false;
                        const styleCode = s.slice(2, -1);
                        return (styleCode >= "30" && styleCode <= "37") || (styleCode >= "90" && styleCode <= "97") || styleCode.startsWith("38;");
                    });
                    if (index !== -1) {
                        activeStyles.splice(index, 1);
                    }
                } else if (code === "49") {
                    const index = activeStyles.findIndex((s) => {
                        if (!s.startsWith("\u001B[") || !s.endsWith("m")) 
return false;
                        const styleCode = s.slice(2, -1);
                        return (styleCode >= "40" && styleCode <= "47") || (styleCode >= "100" && styleCode <= "107") || styleCode.startsWith("48;");
                    });
                    if (index !== -1) {
                        activeStyles.splice(index, 1);
                    }
                } else if (["22", "23", "24", "27", "28", "29"].includes(code)) {
                    const targetCode = {
                        "22": "1", // Bold reset
                        "23": "3", // Italic reset
                        "24": "4", // Underline reset
                        "27": "7", // Inverse reset
                        "28": "8", // Hidden reset
                        "29": "9", // Strikethrough reset
                    }[code];

                    const index = activeStyles.findIndex((s) => {
                        if (!s.startsWith("\u001B[") || !s.endsWith("m")) 
return false;
                        return s.slice(2, -1) === targetCode;
                    });

                    if (index !== -1) {
                        activeStyles.splice(index, 1);
                    }
                } else {
                    // Check if we need to replace a style of the same type
                    if ((code >= "30" && code <= "37") || (code >= "90" && code <= "97") || code.startsWith("38;")) {
                        // Remove any existing foreground color
                        const index = activeStyles.findIndex((s) => {
                            if (!s.startsWith("\u001B[") || !s.endsWith("m")) 
return false;
                            const styleCode = s.slice(2, -1);
                            return (styleCode >= "30" && styleCode <= "37") || (styleCode >= "90" && styleCode <= "97") || styleCode.startsWith("38;");
                        });
                        if (index !== -1) {
                            activeStyles.splice(index, 1);
                        }
                    } else if ((code >= "40" && code <= "47") || (code >= "100" && code <= "107") || code.startsWith("48;")) {
                        // Remove any existing background color
                        const index = activeStyles.findIndex((s) => {
                            if (!s.startsWith("\u001B[") || !s.endsWith("m")) 
return false;
                            const styleCode = s.slice(2, -1);
                            return (styleCode >= "40" && styleCode <= "47") || (styleCode >= "100" && styleCode <= "107") || styleCode.startsWith("48;");
                        });
                        if (index !== -1) {
                            activeStyles.splice(index, 1);
                        }
                    } else if (["1", "3", "4", "7", "8", "9"].includes(code)) {
                        // Remove any existing style of the same type
                        const index = activeStyles.findIndex((s) => {
                            if (!s.startsWith("\u001B[") || !s.endsWith("m")) 
return false;
                            return s.slice(2, -1) === code;
                        });

                        if (index !== -1) {
                            activeStyles.splice(index, 1);
                        }
                    }

                    activeStyles.push(ansi as string);
                }
            } else if (ansi.startsWith("\u001B]8;;") && !ansi.endsWith("\u001B]8;;\u0007")) {
                const index = activeStyles.findIndex((s) => s.startsWith("\u001B]8;;") && !s.endsWith("\u001B]8;;\u0007"));

                if (index !== -1) {
                    activeStyles.splice(index, 1);
                }

                activeStyles.push(ansi);
            }
        }

        // Skip empty parts after processing the style
        if (text === "") {
            continue;
        }

        // Get all closing sequences from the original input
        // that would close the active styles
        let closingSequence = "";

        // If any styles are active, find the appropriate closing sequences
        if (activeStyles.length > 0) {
            // Check if there's a full reset in the input
            if (closingSequences.includes("\u001B[0m")) {
                closingSequence = "\u001B[0m";
            }
            // Otherwise, use specific closing codes in the correct order
            else {
                // Create an ordered collection of closing sequences based on style priority
                const closingParts: string[] = [];

                // First, check for hyperlink closing
                const needsHyperlinkClose: boolean = activeStyles.some((s) => s.startsWith("\u001B]8;;") && !s.endsWith("\u001B]8;;\u0007"));

                if (needsHyperlinkClose && closingSequences.includes("\u001B]8;;\u0007")) {
                    closingParts.push("\u001B]8;;\u0007");
                }

                // Check if we need foreground and background closes
                const needsForegroundClose: boolean = activeStyles.some((s) => {
                    if (!s.startsWith("\u001B[") || !s.endsWith("m")) {
                        return false;
                    }
                    const code = s.slice(2, -1);

                    return (code >= "30" && code <= "37") || (code >= "90" && code <= "97") || code.startsWith("38;");
                });

                const needsBackgroundClose: boolean = activeStyles.some((s) => {
                    if (!s.startsWith("\u001B[") || !s.endsWith("m")) {
                        return false;
                    }

                    const code = s.slice(2, -1);

                    return (code >= "40" && code <= "47") || (code >= "100" && code <= "107") || code.startsWith("48;");
                });

                // Find the positions of opening sequences in the input to determine application order
                const fgOpenPos: number = Math.max(
                    input.indexOf("\u001B[30m"), // Basic black
                    input.indexOf("\u001B[31m"), // Basic red
                    input.indexOf("\u001B[32m"), // Basic green
                    input.indexOf("\u001B[33m"), // Basic yellow
                    input.indexOf("\u001B[34m"), // Basic blue
                    input.indexOf("\u001B[35m"), // Basic magenta
                    input.indexOf("\u001B[36m"), // Basic cyan
                    input.indexOf("\u001B[37m"), // Basic white
                    input.indexOf("\u001B[38;"), // RGB/256 color
                );

                const bgOpenPos: number = Math.max(
                    input.indexOf("\u001B[40m"), // Basic black bg
                    input.indexOf("\u001B[41m"), // Basic red bg
                    input.indexOf("\u001B[42m"), // Basic green bg
                    input.indexOf("\u001B[43m"), // Basic yellow bg
                    input.indexOf("\u001B[44m"), // Basic blue bg
                    input.indexOf("\u001B[45m"), // Basic magenta bg
                    input.indexOf("\u001B[46m"), // Basic cyan bg
                    input.indexOf("\u001B[47m"), // Basic white bg
                    input.indexOf("\u001B[48;"), // RGB/256 color bg
                );

                // If both foreground and background are present, close in reverse order of application
                if (needsForegroundClose && needsBackgroundClose && fgOpenPos >= 0 && bgOpenPos >= 0) {
                    if (fgOpenPos > bgOpenPos) {
                        // Foreground was applied after background, so close foreground first
                        closingParts.push("\u001B[39m", "\u001B[49m"); // Reset background
                    } else {
                        // Background was applied after foreground, so close background first
                        closingParts.push("\u001B[49m", "\u001B[39m"); // Reset foreground
                    }
                } else {
                    // Handle cases where only one type of style is present
                    if (needsForegroundClose) {
                        closingParts.push("\u001B[39m"); // Reset foreground
                    }
                    if (needsBackgroundClose) {
                        closingParts.push("\u001B[49m"); // Reset background
                    }
                }

                // Always check the original input's closing sequence order for consistency
                // If the original input has a different order than what we determined,
                // use the original input's order for better compatibility
                if (needsForegroundClose && needsBackgroundClose && input.indexOf("\u001B[39m") > 0 && input.indexOf("\u001B[49m") > 0) {
                    // Clear the closing parts we already added
                    closingParts.length = 0;

                    // Use the order from the original input
                    if (input.indexOf("\u001B[39m") < input.indexOf("\u001B[49m")) {
                        closingParts.push("\u001B[39m", "\u001B[49m");
                    } else {
                        closingParts.push("\u001B[49m", "\u001B[39m");
                    }
                }

                const formatStyles: FormatStyle[] = [
                    { close: "\u001B[22m", open: "\u001B[1m" }, // Bold
                    { close: "\u001B[23m", open: "\u001B[3m" }, // Italic
                    { close: "\u001B[24m", open: "\u001B[4m" }, // Underline
                    { close: "\u001B[27m", open: "\u001B[7m" }, // Inverse
                    { close: "\u001B[28m", open: "\u001B[8m" }, // Hidden
                    { close: "\u001B[29m", open: "\u001B[9m" }, // Strikethrough
                ];

                // Track which format styles are active and their positions in the input
                const activeFormatStyles: FormatStylePosition[] = formatStyles
                    .filter((style) => activeStyles.includes(style.open))
                    .map((style) => {
                        return {
                            position: input.indexOf(style.open),
                            style,
                        };
                    })
                    .filter((item) => item.position >= 0)
                    // Sort by position, latest first (to close in reverse order)
                    .sort((a, b) => b.position - a.position);

                // Add format style closing sequences in reverse order of application
                for (const item of activeFormatStyles) {
                    if (closingSequences.includes(item.style.close)) {
                        closingParts.push(item.style.close);
                    }
                }

                closingSequence = closingParts.join("");
            }
        }

        segments.push({
            after: closingSequence,
            before: activeStyles.join(""),
            content: text,
            visibleLength: getStringWidth(text, {
                fullWidth: 1,
                wideWidth: 1,
            }),
        });
    }

    return segments;
};

/**
 * Fast slice function optimized for non-ANSI strings with proper Unicode handling.
 * Respects grapheme boundaries and properly handles character width for slicing.
 *
 * @example
 * ```typescript
 * // Basic usage
 * fastSlice('Hello World', 0, 5); // => 'Hello'
 *
 * // With complex scripts
 * fastSlice('টেক্সটSt', 0, 5); // => 'টেক্'
 *
 * // With width options
 * fastSlice('Hello', 0, 3, { width: { fullWidth: 2 } });
 * ```
 *
 * @param {string} inputString - The input string to slice
 * @param {number} startIndex - Start index for the slice (default: 0)
 * @param {number} endIndex - End index for the slice (default: string length)
 * @param {SliceOptions} options - Configuration options for width calculation (default: {})
 * @returns {string} The sliced string with proper Unicode character handling
 */
const fastSlice = (inputString: string, startIndex = 0, endIndex = inputString.length, options: SliceOptions): string => {
    const graphemes = [...(options.segmenter as Intl.Segmenter).segment(inputString)];
    const result: string[] = [];

    let currentWidth = 0;
    let startFound = false;

    // Process each grapheme with respect to its width
    for (const grapheme_ of graphemes) {
        const grapheme = grapheme_ as Intl.SegmentData;
        const graphemeWidth = getStringWidth(grapheme.segment, options.width);

        // Current position before adding this grapheme
        const positionBefore = currentWidth;
        // Position after adding this grapheme
        const positionAfter = currentWidth + graphemeWidth;

        // Check if we've found our starting point yet
        if (!startFound) {
            if (positionBefore < startIndex) {
                // This grapheme is still before our target start
                currentWidth = positionAfter;
                continue;
            } else {
                // We've found our start point
                startFound = true;
            }
        }

        // Now we're in the visible range, check if adding this grapheme would exceed our end point
        if (positionBefore >= endIndex) {
            // We've reached the end, stop processing
            break;
        }

        // Check if adding this grapheme would exceed the endIndex
        if (positionAfter > endIndex) {
            // This grapheme would cross the boundary - do not include it
            break;
        }

        // Add this grapheme to our result
        result.push(grapheme.segment);
        currentWidth = positionAfter;
    }

    return result.join("");
};

/**
 * Configuration options for string slicing operations.
 *
 * @example
 * ```typescript
 * const options: SliceOptions = {
 *   width: {
 *     fullWidth: 2,
 *     ambiguousIsNarrow: true
 *   },
 *   segmenter: new Intl.Segmenter('ja-JP', { granularity: 'word' })
 * };
 * ```
 */
export type SliceOptions = {
    /**
     * Custom segmenter instance for text segmentation
     */
    segmenter?: Intl.Segmenter;

    /**
     * Options for string width calculations
     */
    width?: StringWidthOptions;
};

/**
 * Slice a string with support for ANSI colors and proper Unicode width handling.
 * For strings without ANSI escape sequences, it uses an optimized path.
 * For strings with ANSI sequences, it preserves all styling while correctly handling Unicode characters.
 *
 * @example
 * ```typescript
 * // Basic usage
 * slice('Hello World', 0, 5); // => 'Hello'
 *
 * // With ANSI colors
 * slice('\u001b[31mRed\u001b[0m Text', 0, 3); // => '\u001b[31mRed\u001b[0m'
 *
 * // With width options
 * slice('Hello', 0, 3, { width: { fullWidth: 2 } });
 * ```
 *
 * @param {string} inputString - The input string to slice
 * @param {number} startIndex - Start index for the slice (default: 0)
 * @param {number} endIndex - End index for the slice (default: string length)
 * @param {SliceOptions} options - Configuration options for slicing operation (default: {})
 * @returns {string} The sliced string with preserved ANSI styling if present
 */
export const slice = (inputString: string, startIndex = 0, endIndex = inputString.length, options: SliceOptions = {}): string => {
    const config = {
        segmenter: defaultSegmenter,
        ...options,
    };

    if (startIndex >= endIndex || inputString === "") {
        return "";
    }

    if (startIndex === 0 && endIndex >= inputString.length) {
        return inputString;
    }

    if (startIndex < 0 || endIndex < 0) {
        throw new RangeError("Negative indices aren't supported");
    }

    if (!inputString.includes("\u001B")) {
        return fastSlice(inputString, startIndex, endIndex, config);
    }

    const segments = processIntoStyledSegments(inputString, config);

    let currentPos = 0;
    const visibleSegments: VisibleSegment[] = [];

    for (const [index, segment_] of segments.entries()) {
        const segment = segment_ as StyledSegment;
        const segmentStart = currentPos;
        const segmentEnd = currentPos + segment.visibleLength;

        if (segmentEnd > startIndex && segmentStart < endIndex) {
            const visibleStart = Math.max(0, startIndex - segmentStart);
            const visibleEnd = Math.min(segment.visibleLength, endIndex - segmentStart);

            visibleSegments.push({
                end: visibleEnd,
                index,
                segment,
                start: visibleStart,
            });
        }

        currentPos = segmentEnd;
    }

    if (visibleSegments.length === 0) {
        return "";
    }

    const resultParts: string[] = [];
    const firstSegmentInfo = visibleSegments[0] as VisibleSegment;

    resultParts.push(firstSegmentInfo.segment.before);

    for (let index = 0; index < visibleSegments.length; index++) {
        const { end, segment, start } = visibleSegments[index] as VisibleSegment;

        let slicedContent: string;
        if (start === 0 && end === segment.visibleLength) {
            slicedContent = segment.content;
        } else {
            const graphemes = [...(config.segmenter as Intl.Segmenter).segment(segment.content)];

            slicedContent = graphemes
                .slice(start, end)
                .map((entry) => entry.segment)
                .join("");
        }

        resultParts.push(slicedContent);

        if (index < visibleSegments.length - 1) {
            const nextSegment = (visibleSegments[index + 1] as VisibleSegment).segment;

            if ((segment.after !== "" || nextSegment.before !== "") && segment.after !== nextSegment.before) {
                resultParts.push(segment.after, nextSegment.before);
            }
        }
    }

    const lastSegmentInfo = visibleSegments.at(-1) as VisibleSegment;

    resultParts.push(lastSegmentInfo.segment.after);

    return resultParts.join("");
};
