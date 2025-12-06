import { RE_ANSI, RE_VALID_ANSI_PAIRS, RE_VALID_HYPERLINKS } from "./constants";
import type { StringWidthOptions } from "./get-string-width";
import { getStringWidth } from "./get-string-width";
import LRUCache from "./utils/lru-cache";

const segmentCache = new LRUCache<string, StyledSegment[]>(100);

const defaultSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Represents a segment of text with its associated ANSI styling sequences. */
type StyledSegment = {
    after: string; // ANSI sequences that close styling for this segment
    before: string; // ANSI sequences that apply to this segment
    content: string;
    visibleLength: number;
};

/** Represents a segment with its position (start/end index) in the visible string. */
type VisibleSegment = {
    end: number;
    index: number;
    segment: StyledSegment;
    start: number;
};

const ANSI_RESET_CODES = new Set([
    "0", // Full reset
    "22", // Bold reset
    "23", // Italic reset
    "24", // Underline reset
    "27", // Inverse reset
    "28", // Hidden reset
    "29", // Strikethrough reset
    "39", // Foreground color reset
    "49", // Background color reset
]);
const STYLE_CODES = new Set([
    "1", // Bold
    "3", // Italic
    "4", // Underline
    "7", // Inverse
    "8", // Hidden
    "9", // Strikethrough
]);
const FORMAT_RESET_CODES = new Map([
    ["22", "1"], // Bold reset
    ["23", "3"], // Italic reset
    ["24", "4"], // Underline reset
    ["27", "7"], // Inverse reset
    ["28", "8"], // Hidden reset
    ["29", "9"], // Strikethrough reset
]);

/** Checks if an ANSI code string represents a foreground color code. */
const isForegroundColor = (code: string): boolean => (code >= "30" && code <= "37") || (code >= "90" && code <= "97") || code.startsWith("38;");

/** Checks if an ANSI code string represents a background color code. */
const isBackgroundColor = (code: string): boolean => (code >= "40" && code <= "47") || (code >= "100" && code <= "107") || code.startsWith("48;");

/** Represents an ANSI format style with its opening and closing sequence. */
type FormatStyle = {
    readonly close: string;
    readonly open: string;
};

/** Maps common ANSI formatting styles to their open and close sequences. */
const FORMAT_STYLES: ReadonlyArray<FormatStyle> = [
    { close: "\u001B[22m", open: "\u001B[1m" }, // Bold
    { close: "\u001B[23m", open: "\u001B[3m" }, // Italic
    { close: "\u001B[24m", open: "\u001B[4m" }, // Underline
    { close: "\u001B[27m", open: "\u001B[7m" }, // Inverse
    { close: "\u001B[28m", open: "\u001B[8m" }, // Hidden
    { close: "\u001B[29m", open: "\u001B[9m" }, // Strikethrough
] as const;

/** Find the first occurrence of any substring in the input string. */
const findFirstPositionOfAny = (input: string, substrings: string[]): number => {
    let firstPos = -1;

    for (const substring of substrings) {
        const pos = input.indexOf(substring);

        if (pos !== -1 && (firstPos === -1 || pos < firstPos)) {
            firstPos = pos;
        }
    }

    return firstPos;
};

/**
 * Process a string with ANSI escape sequences into styled segments.
 * Uses LRU caching for improved performance on repeated strings.
 * @param input String with ANSI escape sequences
 * @param options Configuration options
 * @returns Segments with ANSI styling information
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const processIntoStyledSegments = (input: string, options: SliceOptions): StyledSegment[] => {
    // Fast path: If no ANSI sequences, return a single segment
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

    const cachedResult = segmentCache.get(input);

    if (cachedResult) {
        return cachedResult;
    }

    const parts: string[] = [];
    const matches: string[] = [];
    let lastIndex = 0;
    let match;

    RE_ANSI.lastIndex = 0;

    // eslint-disable-next-line no-cond-assign
    while ((match = RE_ANSI.exec(input)) !== null) {
        const matchedText = match[0] as string;

        parts.push(input.slice(lastIndex, match.index));
        matches.push(matchedText);
        lastIndex = match.index + matchedText.length;
    }

    // Add the remaining text after the last match
    if (lastIndex < input.length) {
        parts.push(input.slice(lastIndex));
    }

    const closingSequences: string[] = [];

    for (const ansi of matches) {
        // Fast checks for common patterns
        if (ansi === "\u001B[0m" || ansi === "\u001B]8;;\u0007") {
            closingSequences.push(ansi);

            continue;
        }

        // Handle standard ANSI escape sequences
        if (ansi.startsWith("\u001B[") && ansi.endsWith("m")) {
            const code = ansi.slice(2, -1);

            // Use our set for fast lookups
            if (ANSI_RESET_CODES.has(code)) {
                closingSequences.push(ansi);

                continue;
            }
        }
    }

    const activeStylesSet = new Set<string>();
    const segments: StyledSegment[] = [];

    for (const [index, text] of parts.entries()) {
        // Handle ANSI sequence processing
        if (index > 0 && matches[index - 1]) {
            const ansi = matches[index - 1] as string;

            // Handle reset codes
            if (ansi === "\u001B[0m") {
                activeStylesSet.clear();
            } else if (ansi === "\u001B]8;;\u0007") {
                // Remove hyperlink style
                for (const style of activeStylesSet) {
                    if (style.startsWith("\u001B]8;;") && !style.endsWith("\u001B]8;;\u0007")) {
                        activeStylesSet.delete(style);
                        break; // Only one hyperlink can be active at a time
                    }
                }
            } else if (ansi.startsWith("\u001B[") && ansi.endsWith("m")) {
                const code = ansi.slice(2, -1);

                // Handle foreground color reset
                if (code === "39") {
                    // Efficient removal of foreground color styles
                    for (const style of activeStylesSet) {
                        if (style.startsWith("\u001B[") && style.endsWith("m")) {
                            const styleCode = style.slice(2, -1);

                            if (isForegroundColor(styleCode)) {
                                activeStylesSet.delete(style);
                                break; // Only one foreground color can be active
                            }
                        }
                    }
                // Handle background color reset
                } else if (code === "49") {
                    // Efficient removal of background color styles
                    for (const style of activeStylesSet) {
                        if (style.startsWith("\u001B[") && style.endsWith("m")) {
                            const styleCode = style.slice(2, -1);

                            if (isBackgroundColor(styleCode)) {
                                activeStylesSet.delete(style);
                                break; // Only one background color can be active
                            }
                        }
                    }
                // Handle other style resets
                } else if (FORMAT_RESET_CODES.has(code)) {
                    const targetCode = FORMAT_RESET_CODES.get(code);

                    // Efficiently find and remove the matching style
                    for (const style of activeStylesSet) {
                        if (style === `\u001B[${targetCode as string}m`) {
                            activeStylesSet.delete(style);
                            break;
                        }
                    }
                } else {
                    // Check for foreground color replacement
                    if (isForegroundColor(code)) {
                        // Remove any existing foreground color
                        for (const style of activeStylesSet) {
                            if (style.startsWith("\u001B[") && style.endsWith("m")) {
                                const styleCode = style.slice(2, -1);

                                if (isForegroundColor(styleCode)) {
                                    activeStylesSet.delete(style);
                                    break;
                                }
                            }
                        }
                        // Check for background color replacement
                    } else if (isBackgroundColor(code)) {
                        // Remove any existing background color
                        for (const style of activeStylesSet) {
                            if (style.startsWith("\u001B[") && style.endsWith("m")) {
                                const styleCode = style.slice(2, -1);

                                if (isBackgroundColor(styleCode)) {
                                    activeStylesSet.delete(style);
                                    break;
                                }
                            }
                        }
                        // Check for style attribute replacement
                    } else if (STYLE_CODES.has(code)) {
                        // Remove any existing style of the same type
                        const targetStyle = `\u001B[${code}m`;

                        if (activeStylesSet.has(targetStyle)) {
                            activeStylesSet.delete(targetStyle);
                        }
                    }

                    activeStylesSet.add(ansi);
                }
            } else if (ansi.startsWith("\u001B]8;;") && !ansi.endsWith("\u001B]8;;\u0007")) {
                // Replace any existing hyperlinks
                for (const style of activeStylesSet) {
                    if (style.startsWith("\u001B]8;;") && !style.endsWith("\u001B]8;;\u0007")) {
                        activeStylesSet.delete(style);
                        break;
                    }
                }

                // Add the new hyperlink
                activeStylesSet.add(ansi);
            }
        }

        if (text === "") {
            continue;
        }

        let closingSequence = "";

        if (activeStylesSet.size > 0) {
            // Check for full reset
            if (closingSequences.includes("\u001B[0m")) {
                closingSequence = "\u001B[0m";
            } else {
                const closingParts: string[] = [];

                let needsHyperlinkClose = false;

                for (const style of activeStylesSet) {
                    if (style.startsWith("\u001B]8;;") && !style.endsWith("\u001B]8;;\u0007")) {
                        needsHyperlinkClose = true;
                        break;
                    }
                }

                if (needsHyperlinkClose && closingSequences.includes("\u001B]8;;\u0007")) {
                    closingParts.push("\u001B]8;;\u0007");
                }

                let needsForegroundClose = false;
                let needsBackgroundClose = false;

                for (const style of activeStylesSet) {
                    if (style.startsWith("\u001B[") && style.endsWith("m")) {
                        const styleCode = style.slice(2, -1);

                        if (isForegroundColor(styleCode)) {
                            needsForegroundClose = true;
                        } else if (isBackgroundColor(styleCode)) {
                            needsBackgroundClose = true;
                        }
                    }
                }

                // Determine closing order for foreground and background
                if (needsForegroundClose && needsBackgroundClose) {
                    // Find positions of color codes in the original input for proper closing order
                    const fgOpenPos = findFirstPositionOfAny(input, [
                        "\u001B[3", // Basic colors 30-37
                        "\u001B[9", // Bright colors 90-97
                        "\u001B[38;", // RGB/256 colors
                    ]);

                    const bgOpenPos = findFirstPositionOfAny(input, [
                        "\u001B[4", // Basic colors 40-47
                        "\u001B[10", // Bright colors 100-107
                        "\u001B[48;", // RGB/256 colors
                    ]);

                    if (fgOpenPos >= 0 && bgOpenPos >= 0) {
                        if (fgOpenPos > bgOpenPos) {
                            // Foreground applied after background, close in reverse
                            closingParts.push("\u001B[39m", "\u001B[49m");
                        } else {
                            // Background applied after foreground, close in reverse
                            closingParts.push("\u001B[49m", "\u001B[39m");
                        }
                    } else {
                        // Default order if positions can't be determined
                        closingParts.push("\u001B[39m", "\u001B[49m");
                    }
                } else {
                    // Add individual resets as needed
                    if (needsForegroundClose) {
                        closingParts.push("\u001B[39m");
                    }

                    if (needsBackgroundClose) {
                        closingParts.push("\u001B[49m");
                    }
                }

                // Check if input has a different closing order than what we determined
                if (needsForegroundClose && needsBackgroundClose && input.includes("\u001B[39m") && input.includes("\u001B[49m")) {
                    // Use the original input's order for consistency
                    if (input.indexOf("\u001B[39m") < input.indexOf("\u001B[49m")) {
                        // Remove fg/bg closings we've already added
                        // eslint-disable-next-line sonarjs/no-gratuitous-expressions, sonarjs/no-nested-conditional
                        closingParts.length -= needsForegroundClose && needsBackgroundClose ? 2 : needsForegroundClose || needsBackgroundClose ? 1 : 0;
                        closingParts.push("\u001B[39m", "\u001B[49m");
                    } else if (input.indexOf("\u001B[49m") < input.indexOf("\u001B[39m")) {
                        // Remove fg/bg closings we've already added
                        // eslint-disable-next-line sonarjs/no-gratuitous-expressions, sonarjs/no-nested-conditional
                        closingParts.length -= needsForegroundClose && needsBackgroundClose ? 2 : needsForegroundClose || needsBackgroundClose ? 1 : 0;
                        closingParts.push("\u001B[49m", "\u001B[39m");
                    }
                }

                const activeFormatStyles = FORMAT_STYLES.filter((style) => activeStylesSet.has(style.open))
                    .map((style) => {
                        return {
                            position: input.indexOf(style.open),
                            style,
                        };
                    })
                    .filter((item) => item.position >= 0)
                    .toSorted((a, b) => b.position - a.position); // Sort in reverse order of application

                for (const item of activeFormatStyles) {
                    if (closingSequences.includes(item.style.close)) {
                        closingParts.push(item.style.close);
                    }
                }

                closingSequence = closingParts.join("");
            }
        }

        const activeStylesString = [...activeStylesSet].join("");

        segments.push({
            after: closingSequence,
            before: activeStylesString,
            content: text as string,
            visibleLength: getStringWidth(text as string, {
                fullWidth: 1,
                wideWidth: 1,
            }),
        });
    }

    // Store in cache for future reuse
    segmentCache.set(input, segments);

    return segments;
};

/**
 * Fast slice function for non-ANSI strings with full Unicode support.
 *
 * Features:
 * - Respects grapheme boundaries
 * - Handles combining characters
 * - Supports complex scripts (e.g. CJK, Indic)
 * - Width-aware slicing
 * @example
 * ```typescript
 * // Basic usage
 * fastSlice('Hello World', 0, 5); // 'Hello'
 *
 * // With complex scripts
 * fastSlice('টেক্সটSt', 0, 5); // 'টেক্'
 *
 * // With width options
 * fastSlice('Hello', 0, 3, { width: { fullWidth: 2 } });
 * ```
 * @param inputString String to slice
 * @param startIndex Start index in visual width units (default: 0)
 * @param endIndex End index in visual width units (default: string length)
 * @param options Configuration options
 * @returns Sliced string with preserved character boundaries
 */
const fastSlice = (inputString: string, startIndex: number, endIndex: number, options: SliceOptions): string => {
    const graphemes = [...(options.segmenter as Intl.Segmenter).segment(inputString)];
    const result: string[] = [];

    let currentWidth = 0;
    let startFound = false;

    for (const grapheme of graphemes) {
        const graphemeWidth = getStringWidth(grapheme.segment, options.width);
        const positionBefore = currentWidth;
        const positionAfter = currentWidth + graphemeWidth;

        if (!startFound) {
            if (positionBefore < startIndex) {
                currentWidth = positionAfter;

                continue;
            } else {
                startFound = true;
            }
        }

        // Now we're in the visible range, check if adding this grapheme would exceed our end point
        if (positionBefore >= endIndex) {
            break;
        }

        // Check if adding this grapheme would exceed the endIndex
        if (positionAfter > endIndex) {
            break;
        }

        result.push(grapheme.segment);
        currentWidth = positionAfter;
    }

    return result.join("");
};

/**
 * Configuration options for string slicing operations.
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
 * Slices a string based on visible character width, preserving ANSI escape codes.
 *
 * Handles complex scenarios including grapheme clusters, full-width characters,
 * and ANSI styling (colors, formatting, hyperlinks).
 * @example
 * ```typescript
 * const styledString = "\u001B[31mHello\u001B[39m \u001B[1mWorld\u001B[22m!";
 *
 * // Slice from visible index 2 to 8
 * slice(styledString, 2, 8);
 * // => "\u001B[31mllo\u001B[39m \u001B[1mWo\u001B[22m"
 *
 * // Slice from visible index 7 onwards
 * slice(styledString, 7);
 * // => "\u001B[1morld\u001B[22m!"
 * ```
 * @param inputString The string to slice.
 * @param startIndex The starting visible character index (inclusive). Defaults to 0.
 * @param endIndex The ending visible character index (exclusive). Defaults to the end of the string.
 * @param options Slicing options.
 * @returns The sliced string with ANSI codes preserved.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const slice: (inputString: string, startIndex?: number, endIndex?: number, options?: SliceOptions) => string = (inputString: string, startIndex = 0, endIndex = Number.MAX_SAFE_INTEGER, options: SliceOptions = {}): string => {
    const config = {
        segmenter: defaultSegmenter,
        ...options,
    };

    if (startIndex >= endIndex || inputString === "") {
        return "";
    }

    const inputStringWidth = getStringWidth(inputString, config.width);

    if (startIndex === 0 && endIndex >= inputStringWidth) {
        return inputString;
    }

    if (startIndex < 0 || endIndex < 0) {
        throw new RangeError("Negative indices aren't supported");
    }

    if (!inputString.includes("\u001B")) {
        // ASCII-only strings can be sliced directly
        // eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
        if (/^[\u0000-\u007F]*$/.test(inputString)) {
            return inputString.slice(startIndex, endIndex);
        }

        return fastSlice(inputString, startIndex, endIndex, config);
    }

    RE_VALID_ANSI_PAIRS.lastIndex = 0;
    RE_VALID_HYPERLINKS.lastIndex = 0;

    if (!RE_VALID_ANSI_PAIRS.test(inputString) && !RE_VALID_HYPERLINKS.test(inputString)) {
        // If no valid ANSI pairs found, treat as regular text
        return inputString;
    }

    const segments = processIntoStyledSegments(inputString, config);

    if (segments.length === 0) {
        return "";
    }

    let currentPos = 0;
    const visibleSegments: VisibleSegment[] = [];

    for (const [index, segment] of segments.entries()) {
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
    const firstSegment = (visibleSegments[0] as VisibleSegment).segment;

    // Add first segment's before marker
    resultParts.push(firstSegment.before);

    // Build result from visible segments
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < visibleSegments.length; index++) {
        const { end, segment, start } = visibleSegments[index] as VisibleSegment;

        // Only use expensive grapheme segmentation when necessary
        if (start === 0 && end === segment.visibleLength) {
            resultParts.push(segment.content);
        } else {
            const graphemes = [...(config.segmenter as Intl.Segmenter).segment(segment.content)];

            resultParts.push(
                graphemes
                    .slice(start, end)
                    .map((entry) => entry.segment)
                    .join(""),
            );
        }

        // Handle between-segment styling if not the last segment
        if (index < visibleSegments.length - 1) {
            const nextSegment = (visibleSegments[index + 1] as VisibleSegment).segment;
            const segmentAfter = segment.after;
            const nextBefore = nextSegment.before;

            // Simplified condition with short-circuit evaluation
            if (segmentAfter !== nextBefore && (segmentAfter || nextBefore)) {
                resultParts.push(segmentAfter, nextBefore);
            }
        }
    }

    resultParts.push((visibleSegments.at(-1) as VisibleSegment).segment.after);

    return resultParts.join("");
};
