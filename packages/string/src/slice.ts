import { getStringWidth } from "./get-string-width";

const ANSI_REGEX = /\u001B(?:\[(?:\d+(?:;\d+)*)?m|\]8;;(?:.*?)(?:\u0007|\u001B\\))/g;

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

type StyledSegment = {
    content: string;
    visibleLength: number;
    before: string; // ANSI sequences that apply to this segment
    after: string; // ANSI sequences that close styling for this segment
};

type VisibleSegment = {
    index: number;
    start: number;
    end: number;
    segment: StyledSegment;
};

// Format style type
interface FormatStyle {
    open: string;
    close: string;
}

// Format style with position information
interface FormatStylePosition {
    style: FormatStyle;
    position: number;
}

/**
 * Processes a string with ANSI escape sequences and divides it into styled segments
 * @param input String with ANSI escape sequences
 * @returns Array of styled segments
 */
function processIntoStyledSegments(input: string): StyledSegment[] {
    // If no ANSI sequences, return a single segment
    if (!input.includes("\u001B")) {
        return [
            {
                content: input,
                visibleLength: getStringWidth(input, {
                    wideWidth: 1,
                    fullWidth: 1,
                }),
                before: "",
                after: "",
            },
        ];
    }

    // Split string by ANSI escape sequences
    const parts: string[] = input.split(ANSI_REGEX);
    const matches: string[] = Array.from(input.matchAll(ANSI_REGEX), (m) => m[0]);

    const segments: StyledSegment[] = [];

    // Track all opening and closing ANSI sequences
    const openingSequences: string[] = [];
    const closingSequences: string[] = [];

    // Process each ANSI sequence first to identify all opening and closing sequences
    for (const ansi of matches) {
        // Reset code - full reset
        if (ansi === "\u001B[0m") {
            closingSequences.push(ansi);
            continue;
        }

        // Hyperlink closing
        if (ansi === "\u001B]8;;\u0007") {
            closingSequences.push(ansi);
            continue;
        }

        // Other reset codes like 39m, 49m, 22m, etc.
        if (ansi.startsWith("\u001B[") && ansi.endsWith("m")) {
            const code = ansi.slice(2, -1);
            if (["0", "39", "49", "22", "23", "24", "27", "28", "29"].includes(code)) {
                closingSequences.push(ansi);
                continue;
            }
        }

        // Otherwise, treat it as an opening sequence
        openingSequences.push(ansi);
    }

    // Now process the text parts
    const activeStyles: string[] = [];

    for (let i = 0; i < parts.length; i++) {
        const text = parts[i] as string;

        // Process ANSI code before this text part
        if (i > 0 && matches[i - 1]) {
            const ansi = matches[i - 1] as string;

            // Full reset - clear all active styles
            if (ansi === "\u001B[0m") {
                activeStyles.length = 0;
            }
            // Hyperlink closing
            else if (ansi === "\u001B]8;;\u0007") {
                const index = activeStyles.findIndex((s) => s.startsWith("\u001B]8;;") && !s.endsWith("\u001B]8;;\u0007"));
                if (index !== -1) {
                    activeStyles.splice(index, 1);
                }
            }
            // Other specific reset codes
            else if (ansi.startsWith("\u001B[") && ansi.endsWith("m")) {
                const code = ansi.slice(2, -1);

                // Foreground color reset
                if (code === "39") {
                    const index = activeStyles.findIndex((s) => {
                        if (!s.startsWith("\u001B[") || !s.endsWith("m")) return false;
                        const styleCode = s.slice(2, -1);
                        return (styleCode >= "30" && styleCode <= "37") || (styleCode >= "90" && styleCode <= "97") || styleCode.startsWith("38;");
                    });
                    if (index !== -1) {
                        activeStyles.splice(index, 1);
                    }
                }
                // Background color reset
                else if (code === "49") {
                    const index = activeStyles.findIndex((s) => {
                        if (!s.startsWith("\u001B[") || !s.endsWith("m")) return false;
                        const styleCode = s.slice(2, -1);
                        return (styleCode >= "40" && styleCode <= "47") || (styleCode >= "100" && styleCode <= "107") || styleCode.startsWith("48;");
                    });
                    if (index !== -1) {
                        activeStyles.splice(index, 1);
                    }
                }
                // Other specific reset codes
                else if (["22", "23", "24", "27", "28", "29"].includes(code)) {
                    const targetCode = {
                        "22": "1", // Bold reset
                        "23": "3", // Italic reset
                        "24": "4", // Underline reset
                        "27": "7", // Inverse reset
                        "28": "8", // Hidden reset
                        "29": "9", // Strikethrough reset
                    }[code];

                    const index = activeStyles.findIndex((s) => {
                        if (!s.startsWith("\u001B[") || !s.endsWith("m")) return false;
                        return s.slice(2, -1) === targetCode;
                    });

                    if (index !== -1) {
                        activeStyles.splice(index, 1);
                    }
                }
                // Opening style - add to active styles
                else {
                    // Check if we need to replace a style of the same type
                    if ((code >= "30" && code <= "37") || (code >= "90" && code <= "97") || code.startsWith("38;")) {
                        // Remove any existing foreground color
                        const index = activeStyles.findIndex((s) => {
                            if (!s.startsWith("\u001B[") || !s.endsWith("m")) return false;
                            const styleCode = s.slice(2, -1);
                            return (styleCode >= "30" && styleCode <= "37") || (styleCode >= "90" && styleCode <= "97") || styleCode.startsWith("38;");
                        });
                        if (index !== -1) {
                            activeStyles.splice(index, 1);
                        }
                    } else if ((code >= "40" && code <= "47") || (code >= "100" && code <= "107") || code.startsWith("48;")) {
                        // Remove any existing background color
                        const index = activeStyles.findIndex((s) => {
                            if (!s.startsWith("\u001B[") || !s.endsWith("m")) return false;
                            const styleCode = s.slice(2, -1);
                            return (styleCode >= "40" && styleCode <= "47") || (styleCode >= "100" && styleCode <= "107") || styleCode.startsWith("48;");
                        });
                        if (index !== -1) {
                            activeStyles.splice(index, 1);
                        }
                    } else if (["1", "3", "4", "7", "8", "9"].includes(code)) {
                        // Remove any existing style of the same type
                        const index = activeStyles.findIndex((s) => {
                            if (!s.startsWith("\u001B[") || !s.endsWith("m")) return false;
                            return s.slice(2, -1) === code;
                        });
                        if (index !== -1) {
                            activeStyles.splice(index, 1);
                        }
                    }

                    // Add the new style
                    activeStyles.push(ansi as string);
                }
            }
            // Hyperlink start
            else if (ansi.startsWith("\u001B]8;;") && !ansi.endsWith("\u001B]8;;\u0007")) {
                // Remove any existing hyperlink
                const index = activeStyles.findIndex((s) => s.startsWith("\u001B]8;;") && !s.endsWith("\u001B]8;;\u0007"));
                if (index !== -1) {
                    activeStyles.splice(index, 1);
                }

                // Add the new hyperlink
                activeStyles.push(ansi);
            }
        }

        // Skip empty parts after processing the style
        if (text === "") {
            continue;
        }

        // Get all closing sequences from the original input
        // that would close the active styles
        let closingSequence: string = "";

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
                    if (!s.startsWith("\u001B[") || !s.endsWith("m")) return false;
                    const code = s.slice(2, -1);
                    return (code >= "30" && code <= "37") || (code >= "90" && code <= "97") || code.startsWith("38;");
                });

                const needsBackgroundClose: boolean = activeStyles.some((s) => {
                    if (!s.startsWith("\u001B[") || !s.endsWith("m")) return false;
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
                        closingParts.push("\u001B[39m"); // Reset foreground
                        closingParts.push("\u001B[49m"); // Reset background
                    } else {
                        // Background was applied after foreground, so close background first
                        closingParts.push("\u001B[49m"); // Reset background
                        closingParts.push("\u001B[39m"); // Reset foreground
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
                        // Original input closes foreground first
                        closingParts.push("\u001B[39m");
                        closingParts.push("\u001B[49m");
                    } else {
                        // Original input closes background first
                        closingParts.push("\u001B[49m");
                        closingParts.push("\u001B[39m");
                    }
                }

                // Check for format styles (bold, italic, underline, etc.)
                // We close these in reverse order of application as well
                const formatStyles: FormatStyle[] = [
                    { open: "\u001B[1m", close: "\u001B[22m" }, // Bold
                    { open: "\u001B[3m", close: "\u001B[23m" }, // Italic
                    { open: "\u001B[4m", close: "\u001B[24m" }, // Underline
                    { open: "\u001B[7m", close: "\u001B[27m" }, // Inverse
                    { open: "\u001B[8m", close: "\u001B[28m" }, // Hidden
                    { open: "\u001B[9m", close: "\u001B[29m" }, // Strikethrough
                ];

                // Track which format styles are active and their positions in the input
                const activeFormatStyles: FormatStylePosition[] = formatStyles
                    .filter((style) => activeStyles.some((s) => s === style.open))
                    .map((style) => ({
                        style,
                        position: input.indexOf(style.open),
                    }))
                    .filter((item) => item.position >= 0)
                    // Sort by position, latest first (to close in reverse order)
                    .sort((a, b) => b.position - a.position);

                // Add format style closing sequences in reverse order of application
                for (const item of activeFormatStyles) {
                    if (closingSequences.includes(item.style.close)) {
                        closingParts.push(item.style.close);
                    }
                }

                // Join all closing parts
                closingSequence = closingParts.join("");
            }
        }

        // Create the segment
        segments.push({
            content: text,
            visibleLength: getStringWidth(text, {
                wideWidth: 1,
                fullWidth: 1,
            }),
            before: activeStyles.join(""),
            after: closingSequence,
        });
    }

    return segments;
}

/**
 * High-performance function to slice ANSI-colored strings while preserving style codes.
 * Uses a segment-based approach that directly associates styling with content.
 * Handles all ANSI codes including unknown ones.
 *
 * @param {string} inputString - The original string with ANSI escape codes
 * @param {number} startIndex - Start index for the slice (default: 0)
 * @param {number} endIndex - End index for the slice (default: string length)
 * @returns {string} The sliced string with preserved ANSI styling
 */
function slice(inputString: string, startIndex = 0, endIndex = inputString.length): string {
    if (startIndex >= endIndex || inputString === "") {
        return "";
    }

    if (startIndex === 0 && endIndex >= inputString.length) {
        return inputString;
    }

    if (startIndex < 0 || endIndex < 0) {
        throw new RangeError("Negative indices aren't supported");
    }

    const segments = processIntoStyledSegments(inputString);

    let currentPos = 0;
    const visibleSegments: VisibleSegment[] = [];

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i] as StyledSegment;
        const segmentStart = currentPos;
        const segmentEnd = currentPos + segment.visibleLength;

        if (segmentEnd > startIndex && segmentStart < endIndex) {
            const visibleStart = Math.max(0, startIndex - segmentStart);
            const visibleEnd = Math.min(segment.visibleLength, endIndex - segmentStart);

            visibleSegments.push({
                index: i,
                start: visibleStart,
                end: visibleEnd,
                segment,
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

    for (let i = 0; i < visibleSegments.length; i++) {
        const { segment, start, end } = visibleSegments[i] as VisibleSegment;

        let slicedContent: string;
        if (start === 0 && end === segment.visibleLength) {
                slicedContent = segment.content;
        } else {
            const graphemes = Array.from(segmenter.segment(segment.content));

            slicedContent = graphemes
                .slice(start, end)
                .map((entry) => entry.segment)
                .join("");
        }

        resultParts.push(slicedContent);

        if (i < visibleSegments.length - 1) {
            const nextSegment = (visibleSegments[i + 1] as VisibleSegment).segment;

            if (segment.after !== "" || nextSegment.before !== "") {
                if (segment.after !== nextSegment.before) {
                    resultParts.push(segment.after);
                    resultParts.push(nextSegment.before);
                }
            }
        }
    }

    const lastSegmentInfo = visibleSegments[visibleSegments.length - 1] as VisibleSegment;

    resultParts.push(lastSegmentInfo.segment.after);

    return resultParts.join("");
}

export default slice;
