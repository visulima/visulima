// eslint-disable-next-line import/no-extraneous-dependencies
import { eastAsianWidthType } from "get-east-asian-width";

import { RE_ANSI, RE_ANSI_LINK_END, RE_CONTROL, RE_EMOJI } from "./constants";

/**
 * Regular expression for Latin characters - optimized for width calculation
 * Using sticky flag for better performance in sequential matching
 */
const RE_LATIN_CHARS = /(?:[\u0020-\u007E\u00A0-\u00FF](?!\uFE0F)){1,1000}/y;

/**
 * Gets the width of a character from cache or calculates it
 * @param codePoint Unicode code point
 * @param config Width configuration
 */
const getCachedCharWidth = (codePoint: number, config: any): number => {
    // Split the code point into high and low parts for efficient caching
    const highBits = Math.floor(codePoint / 65536);
    const lowBits = codePoint % 65536;

    // Get or create the second-level map
    let lowMap = charWidthCache.get(highBits);
    if (!lowMap) {
        lowMap = new Map();
        charWidthCache.set(highBits, lowMap);
    }

    // Check if width is already cached
    if (lowMap.has(lowBits)) {
        return lowMap.get(lowBits);
    }

    // Calculate width based on character type
    let width;

    // Fast path for common character ranges
    if (getCharType(codePoint) === "latin") {
        width = config.width.regular;
    } else if (getCharType(codePoint) === "control") {
        width = config.width.control;
    } else if (getCharType(codePoint) === "wide") {
        width = config.width.wide;
    } else {
        // Fall back to East Asian width calculation for other characters
        const eaw = eastAsianWidthType(codePoint);

        switch (eaw) {
            case "fullwidth":
                width = config.width.fullWidth;
                break;
            case "wide":
                width = config.width.wide;
                break;
            case "ambiguous":
                width = config.width.ambiguousIsNarrow ? config.width.regular : config.width.wide;
                break;
            default:
                width = config.width.regular;
        }
    }

    // Cache the result
    lowMap.set(lowBits, width);
    return width;
};

/**
 * Configuration options for string width calculation and truncation.
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const options: StringTruncatedWidthOptions = {};
 *
 * // Custom character widths
 * const options: StringTruncatedWidthOptions = {
 *   regularWidth: 2,
 *   emojiWidth: 3,
 *   tabWidth: 4
 * };
 *
 * // Truncation settings
 * const options: StringTruncatedWidthOptions = {
 *   limit: 10,
 *   ellipsis: '...',
 *   ellipsisWidth: 3
 * };
 * ```
 */
export interface StringTruncatedWidthOptions {
    /**
     * Whether ambiguous characters should be treated as narrow
     * @default false
     */
    ambiguousIsNarrow?: boolean;

    /**
     * Width of ambiguous-width characters
     * @default 1
     */
    ambiguousWidth?: number;

    /**
     * Width of ANSI escape sequences
     * @default 0
     */
    ansiWidth?: number;

    /**
     * Width of control characters
     * @default 0
     */
    controlWidth?: number;

    /**
     * Whether to count ANSI escape codes in width calculation
     * @default false
     */
    countAnsiEscapeCodes?: boolean;

    /**
     * String to append when truncation occurs
     * @default ''
     */
    ellipsis?: string;

    /**
     * Width of the ellipsis string
     * If not provided, it will be calculated using getStringTruncatedWidth
     */
    ellipsisWidth?: number;

    /**
     * Width of emoji characters
     * @default 2
     */
    emojiWidth?: number;

    /**
     * Width of full-width characters
     * @default 2
     */
    fullWidth?: number;

    /**
     * Width of half-width characters
     * @default 1
     */
    halfWidth?: number;

    /**
     * Maximum width limit for the string
     * @default Infinity
     */
    limit?: number;

    /**
     * Width of regular characters
     * @default 1
     */
    regularWidth?: number;

    /**
     * Width of tab characters
     * @default 8
     */
    tabWidth?: number;

    /**
     * Width of wide characters
     * @default 2
     */
    wideWidth?: number;
}

/**
 * Result object returned by getStringTruncatedWidth containing width calculation and the truncation details.
 *
 * @example
 * ```typescript
 * // No truncation
 * const result: StringTruncatedWidthResult = {
 *   width: 5,        // Total visual width
 *   truncated: false, // String was not truncated
 *   ellipsed: false, // No ellipsis added
 *   index: 5,        // Full string length
 * };
 *
 * // With truncation
 * const result: StringTruncatedWidthResult = {
 *   width: 8,        // Width including ellipsis
 *   truncated: true,  // String was truncated
 *   ellipsed: true,   // Ellipsis was added
 *   index: 5,         // Truncation point
 * };
 * ```
 */
export interface StringTruncatedWidthResult {
    /**
     * Whether an ellipsis was added
     */
    ellipsed: boolean;

    /**
     * The index at which truncation occurred (if any)
     */
    index: number;

    /**
     * Whether the string was truncated
     */
    truncated: boolean;

    /**
     * The calculated width of the string
     */
    width: number;
}

/**
 * Fast character type check using code point ranges
 * Optimized for performance by checking common cases first
 */
const getCharType = (codePoint: number): "latin" | "control" | "wide" | "half-width" | "other" | "zero" => {
    // ASCII printable range (most common case first for performance)
    if (codePoint >= 0x0020 && codePoint <= 0x007e) {
        return "latin";
    }

    // Unicode range for Zero Width characters
    if (codePoint === 0x200b || codePoint === 0x200c || codePoint === 0x200d || codePoint === 0x2060) {
        return "zero";
    }

    // Control characters
    if (codePoint <= 0x001f || (codePoint >= 0x007f && codePoint <= 0x009f)) {
        return "control";
    }

    // Latin-1 Supplement (also common in western text)
    if (codePoint >= 0x00a0 && codePoint <= 0x00ff) {
        return "latin";
    }

    // Half-width katakana (U+FF61–U+FF9F)
    if (codePoint >= 0xff61 && codePoint <= 0xff9f) {
        return "half-width";
    }

    // Full-width and CJK characters (wide)
    if (
        (codePoint >= 0x1100 && codePoint <= 0x11ff) || // Hangul Jamo
        (codePoint >= 0x2e80 && codePoint <= 0x9fff) || // CJK & radicals
        (codePoint >= 0xac00 && codePoint <= 0xd7af) || // Hangul Syllables
        (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK Compatibility Ideographs
        (codePoint >= 0xff00 && codePoint <= 0xffef && !(codePoint >= 0xff61 && codePoint <= 0xff9f)) || // Full-width Forms (excluding half-width katakana)
        (codePoint >= 0x3040 && codePoint <= 0x30ff)
    ) {
        // Hiragana & Katakana
        return "wide";
    }

    return "other";
};

/**
 * Cache for storing pre-calculated character widths
 * Uses a two-level structure for memory efficiency:
 * - First level: Maps the high 16 bits of code point to a second-level map
 * - Second level: Maps the low 16 bits to actual width values
 */
const charWidthCache = new Map();

/**
 * Calculate the visual width of a string with optional truncation, handling various Unicode character types.
 * This function provides detailed control over character width calculations and truncation behavior.
 * Returns the truncated content along with width information.
 *
 * Features:
 * - Handles Unicode characters (full-width, wide, ambiguous, etc.)
 * - Supports emojis and emoji sequences
 * - Processes ANSI escape codes
 * - Handles combining characters and modifiers
 * - Supports string truncation with customizable ellipsis
 * - Returns the truncated string content
 *
 * @example
 * ```typescript
 * // Basic width calculation
 * getStringTruncatedWidth('hello'); // => { width: 5, truncated: false, ellipsed: false, index: 5 }
 *
 * // With truncation
 * getStringTruncatedWidth('hello world', {
 *   limit: 8,
 *   ellipsis: '...'
 * }); // => { width: 8, truncated: true, ellipsed: true, index: 5 }
 *
 * // With custom character widths
 * getStringTruncatedWidth('あいう', {
 *   fullWidth: 2,
 *   ambiguousIsNarrow: true
 * }); // => { width: 6, truncated: false, ellipsed: false, index: 3 }
 * ```
 *
 * @param input - The string to calculate the width for and potentially truncate
 * @param options - Configuration options for width calculation and truncation
 *
 * @returns Result object containing:
 *          - width: The calculated visual width of the string
 *          - truncated: Whether the string was truncated
 *          - ellipsed: Whether an ellipsis was added
 *          - index: The index at which truncation occurred (if any)
 */
export const getStringTruncatedWidth = (input: string, options: StringTruncatedWidthOptions = {}): StringTruncatedWidthResult => {
    if (!input || input.length === 0) {
        return { width: 0, truncated: false, ellipsed: false, index: 0 };
    }

    // Initialize configuration with smart defaults
    const config = {
        truncation: {
            ellipsis: options.ellipsis ?? "",
            ellipsisWidth:
                options.ellipsisWidth ??
                (options.ellipsis
                    ? getStringTruncatedWidth(options.ellipsis, {
                          ...options,
                          ellipsis: "",
                          ellipsisWidth: 0,
                          limit: Number.POSITIVE_INFINITY,
                      }).width
                    : 0),
            limit: options.limit ?? Number.POSITIVE_INFINITY,
        },
        width: {
            ambiguous: options.ambiguousWidth ?? 1,
            ambiguousIsNarrow: options.ambiguousIsNarrow ?? false,
            ansi: options.ansiWidth ?? 0,
            control: options.controlWidth ?? 0,
            emoji: options.emojiWidth ?? 2,
            fullWidth: options.fullWidth ?? 2,
            halfWidth: options.halfWidth ?? 1,
            regular: options.regularWidth ?? 1,
            tab: options.tabWidth ?? 8,
            wide: options.wideWidth ?? 2,
        },
    };

    const truncationLimit = Math.max(0, config.truncation.limit - config.truncation.ellipsisWidth);
    const { length } = input;

    // Determine if we should use caching strategy based on string length
    const useCaching = length > 10000; // Only use caching for very long strings

    let index = 0;
    let width = 0;
    let truncationIndex = length;
    let truncationEnabled = false;

    // Quick check for ANSI sequences - if none present, can skip those checks in the main loop
    const hasAnsi = input.includes("\u001B") || input.includes("\u009B");

    // Process characters until end or truncation point
    while (index < length) {
        // Handle ANSI escape sequences - only check if we know there's at least one present
        if (hasAnsi && (input[index] === "\u001B" || input[index] === "\u009B")) {
            RE_ANSI.lastIndex = index;
            if (RE_ANSI.test(input)) {
                const ansiLength = RE_ANSI.lastIndex - index;
                const ansiWidth = options.countAnsiEscapeCodes ? ansiLength : config.width.ansi;

                // Special handling for ANSI hyperlinks (optimization: fast path for non-hyperlinks)
                if (index + 3 < length && input.slice(index, index + 4) === "\u001B]8;") {
                    const startPos = RE_ANSI.lastIndex;
                    RE_ANSI_LINK_END.lastIndex = startPos;

                    if (RE_ANSI_LINK_END.test(input)) {
                        const endPos = RE_ANSI_LINK_END.lastIndex;
                        const textContent = input.slice(startPos, endPos - 5);
                        const textWidth = textContent.length;

                        if (width + textWidth > truncationLimit) {
                            truncationIndex = Math.min(truncationIndex, startPos);

                            if (width + textWidth > config.truncation.limit) {
                                truncationEnabled = true;
                                break;
                            }
                        }

                        width += textWidth;
                        index = endPos;
                        continue;
                    }
                }

                // Standard ANSI sequence
                if (width + ansiWidth > truncationLimit) {
                    truncationIndex = Math.min(truncationIndex, index);

                    if (width + ansiWidth > config.truncation.limit) {
                        truncationEnabled = true;
                        break;
                    }
                }

                width += ansiWidth;
                index = RE_ANSI.lastIndex;
                continue;
            }
        }

        // Fast path for zero-width characters
        const charCode = input.charCodeAt(index);
        if (charCode === 0x200b || charCode === 0xfeff || (charCode >= 0x2060 && charCode <= 0x2064)) {
            index++;
            continue;
        }

        // Fast path for tabs
        if (charCode === 9) {
            // Tab character
            if (width + config.width.tab > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index);

                if (width + config.width.tab > config.truncation.limit) {
                    truncationEnabled = true;
                    break;
                }
            }

            width += config.width.tab;
            index++;
            continue;
        }

        // Handle Latin character sequences efficiently - most common case for western text
        RE_LATIN_CHARS.lastIndex = index;
        if (RE_LATIN_CHARS.test(input)) {
            const latinLength = RE_LATIN_CHARS.lastIndex - index;
            const latinWidth = latinLength * config.width.regular;

            // Check if this sequence causes truncation
            if (width + latinWidth > truncationLimit) {
                // Calculate exact character that crosses the limit
                const charsToLimit = Math.floor((truncationLimit - width) / config.width.regular);
                truncationIndex = Math.min(truncationIndex, index + charsToLimit);

                if (width + latinWidth > config.truncation.limit) {
                    truncationEnabled = true;
                    break;
                }
            }

            width += latinWidth;
            index = RE_LATIN_CHARS.lastIndex;
            continue;
        }

        // Handle control characters
        if (charCode <= 0x001f || (charCode >= 0x007f && charCode <= 0x009f)) {
            RE_CONTROL.lastIndex = index;
            if (RE_CONTROL.test(input)) {
                const controlLength = RE_CONTROL.lastIndex - index;
                const controlWidth = controlLength * config.width.control;

                if (width + controlWidth > truncationLimit) {
                    truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / config.width.control));

                    if (width + controlWidth > config.truncation.limit) {
                        truncationEnabled = true;
                        break;
                    }
                }

                width += controlWidth;
                index = RE_CONTROL.lastIndex;
                continue;
            }
        }

        // Handle emoji characters - defer to emoji regex since emoji detection is complex
        RE_EMOJI.lastIndex = index;
        if (RE_EMOJI.test(input)) {
            if (width + config.width.emoji > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index);

                if (width + config.width.emoji > config.truncation.limit) {
                    truncationEnabled = true;
                    break;
                }
            }

            width += config.width.emoji;
            index = RE_EMOJI.lastIndex;
            continue;
        }

        const codePoint = input.codePointAt(index) ?? 0;

        let charWidth: number;

        if (useCaching) {
            charWidth = getCachedCharWidth(codePoint, config);
        } else {
            const charType = getCharType(codePoint);

            if (charType === "latin") {
                charWidth = config.width.regular;
            } else if (charType === "control") {
                charWidth = config.width.control;
            } else if (charType === "wide") {
                charWidth = config.width.wide;
            } else if (charType === "half-width") {
                charWidth = config.width.halfWidth;
            } else if (charType === "zero") {
                charWidth = 0;
            } else {
                const eaw = eastAsianWidthType(codePoint);

                switch (eaw) {
                    case "fullwidth":
                        charWidth = config.width.fullWidth;
                        break;
                    case "wide":
                        charWidth = config.width.wide;
                        break;
                    case "ambiguous":
                        charWidth = config.width.ambiguousIsNarrow ? config.width.regular : config.width.wide;
                        break;
                    default:
                        charWidth = config.width.regular;
                }
            }
        }

        if (width + charWidth > truncationLimit) {
            truncationIndex = Math.min(truncationIndex, index);

            if (width + charWidth > config.truncation.limit) {
                truncationEnabled = true;
                break;
            }
        }

        width += charWidth;
        // Use the actual character length to handle surrogate pairs correctly
        index += codePoint > 0xffff ? 2 : 1;
    }

    let finalWidth = width;

    if (truncationEnabled) {
        finalWidth = Math.min(
            width + (config.truncation.limit >= config.truncation.ellipsisWidth ? config.truncation.ellipsisWidth : 0),
            config.truncation.limit,
        );
    }

    return {
        ellipsed: truncationEnabled && config.truncation.limit >= config.truncation.ellipsisWidth,
        index: truncationEnabled ? truncationIndex : length,
        truncated: truncationEnabled,
        width: finalWidth,
    };
};
