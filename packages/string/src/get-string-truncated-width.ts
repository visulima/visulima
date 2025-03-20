// eslint-disable-next-line import/no-extraneous-dependencies
import { eastAsianWidthType } from "get-east-asian-width";

import { RE_ANSI, RE_ANSI_LINK_END, RE_CONTROL, RE_EMOJI } from "./constants";

/**
 * Regular expression for Latin characters with sticky flag for better performance.
 * Matches ASCII and extended Latin-1 characters, excluding variation selectors.
 */
const RE_LATIN_CHARS = /(?:[\u0020-\u007E\u00A0-\u00FF](?!\uFE0F)){1,1000}/y;

/**
 * Gets the width of a character from cache or calculates it using a two-level caching strategy.
 * 
 * @param codePoint - Unicode code point to get width for
 * @param config - Character width configuration
 * @returns The visual width of the character
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
/**
 * Checks if a Unicode code point represents a combining character, variation selector, or diacritic mark.
 * 
 * Supports combining marks from:
 * - Universal combining marks (U+0300-U+036F, etc.)
 * - Variation selectors (U+FE00-U+FE0F, U+E0100-U+E01EF)
 * - Southeast Asian scripts (Thai, Lao)
 * - Indic scripts (Devanagari, Bengali, Gurmukhi)
 * - Arabic and Persian
 * - Hebrew
 * - Tibetan
 * - Vietnamese
 *
 * @example
 * ```typescript
 * isCombiningCharacter(0x0300); // true (combining grave accent)
 * isCombiningCharacter(0x0E31); // true (Thai vowel mark)
 * isCombiningCharacter(0x0061); // false (Latin 'a')
 * ```
 *
 * @param codePoint - The Unicode code point to check
 * @returns True if the code point is a combining character
 */
const isCombiningCharacter = (codePoint: number): boolean => {
    // Universal combining marks
    if ((codePoint >= 0x0300 && codePoint <= 0x036f) || // Combining Diacritical Marks
        (codePoint >= 0x1ab0 && codePoint <= 0x1aff) || // Combining Diacritical Marks Extended
        (codePoint >= 0x1dc0 && codePoint <= 0x1dff) || // Combining Diacritical Marks Supplement
        (codePoint >= 0x20d0 && codePoint <= 0x20ff) || // Combining Diacritical Marks for Symbols
        (codePoint >= 0xfe20 && codePoint <= 0xfe2f)) { // Combining Half Marks
        return true;
    }

    // Variation and VS selectors
    if ((codePoint >= 0xe0100 && codePoint <= 0xe01ef) || // Variation Selectors Supplement
        (codePoint >= 0xfe00 && codePoint <= 0xfe0f)) { // Variation Selectors
        return true;
    }

    // Southeast Asian scripts
    if ((codePoint >= 0x0e31 && codePoint <= 0x0e3a) || // Thai vowel marks and tone marks
        (codePoint >= 0x0e47 && codePoint <= 0x0e4e) || // Thai diacritics
        (codePoint >= 0x0eb1 && codePoint <= 0x0eb9) || // Lao vowel marks
        (codePoint >= 0x0ebb && codePoint <= 0x0ebc) || // Lao vowel signs
        (codePoint >= 0x0ec8 && codePoint <= 0x0ecd)) { // Lao tone marks
        return true;
    }

    // Indic scripts
    if ((codePoint >= 0x0900 && codePoint <= 0x0903) || // Devanagari signs
        (codePoint >= 0x093a && codePoint <= 0x094f) || // Devanagari vowel signs and virama
        (codePoint >= 0x0951 && codePoint <= 0x0957) || // Devanagari stress marks
        (codePoint >= 0x0962 && codePoint <= 0x0963) || // Devanagari vowel signs
        (codePoint >= 0x0981 && codePoint <= 0x0983) || // Bengali signs
        (codePoint >= 0x09bc && codePoint <= 0x09c4) || // Bengali vowel signs
        (codePoint >= 0x09cd && codePoint <= 0x09cd) || // Bengali virama
        (codePoint >= 0x0a01 && codePoint <= 0x0a03) || // Gurmukhi signs
        (codePoint >= 0x0a3c && codePoint <= 0x0a4d)) { // Gurmukhi modifiers
        return true;
    }

    // Arabic and Persian
    if ((codePoint >= 0x064b && codePoint <= 0x065f) || // Arabic diacritics
        (codePoint >= 0x0670 && codePoint <= 0x0670) || // Arabic letter superscript alef
        (codePoint >= 0x06d6 && codePoint <= 0x06ed) || // Arabic small high signs
        (codePoint >= 0x08e4 && codePoint <= 0x08fe)) { // Arabic mark extensions
        return true;
    }

    // Hebrew
    if ((codePoint >= 0x0591 && codePoint <= 0x05bd) || // Hebrew points
        (codePoint >= 0x05bf && codePoint <= 0x05bf) || // Hebrew point rafe
        (codePoint >= 0x05c1 && codePoint <= 0x05c2) || // Hebrew points
        (codePoint >= 0x05c4 && codePoint <= 0x05c5) || // Hebrew marks
        (codePoint >= 0x05c7 && codePoint <= 0x05c7)) { // Hebrew point qamats qatan
        return true;
    }

    // Tibetan
    if ((codePoint >= 0x0f35 && codePoint <= 0x0f35) || // Tibetan mark nada
        (codePoint >= 0x0f37 && codePoint <= 0x0f37) || // Tibetan mark nada
        (codePoint >= 0x0f39 && codePoint <= 0x0f39) || // Tibetan mark tsa phru
        (codePoint >= 0x0f71 && codePoint <= 0x0f7e) || // Tibetan vowel signs
        (codePoint >= 0x0f80 && codePoint <= 0x0f84) || // Tibetan vowel signs and virama
        (codePoint >= 0x0f86 && codePoint <= 0x0f87)) { // Tibetan signs
        return true;
    }

    // Vietnamese
    if ((codePoint >= 0x0300 && codePoint <= 0x0309) || // Vietnamese tone marks
        (codePoint >= 0x0323 && codePoint <= 0x0323)) { // Vietnamese tone marks
        return true;
    }

    return false;
};

const getCharType = (codePoint: number): "latin" | "control" | "wide" | "other" | "zero" => {
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

    // Full-width and CJK characters (wide)
    if (
        (codePoint >= 0x1100 && codePoint <= 0x11ff) || // Hangul Jamo
        (codePoint >= 0x2e80 && codePoint <= 0x9fff) || // CJK & radicals
        (codePoint >= 0xac00 && codePoint <= 0xd7af) || // Hangul Syllables
        (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK Compatibility Ideographs
        (codePoint >= 0xff00 && codePoint <= 0xffef && !(codePoint >= 0xff61 && codePoint <= 0xff9f)) || // Full-width Forms (excluding half-width katakana)
        (codePoint >= 0x3040 && codePoint <= 0x30ff) // Hiragana & Katakana
    ) {
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
 * 
 * @example
 * ```typescript
 * // Basic width calculation
 * getStringTruncatedWidth('hello');
 * // => { width: 5, truncated: false, ellipsed: false, index: 5 }
 * 
 * // With truncation
 * getStringTruncatedWidth('hello world', {
 *   limit: 8,
 *   ellipsis: '...'
 * });
 * // => { width: 8, truncated: true, ellipsed: true, index: 5 }
 * 
 * // With custom character widths
 * getStringTruncatedWidth('あいう', {
 *   fullWidth: 2,
 *   ambiguousIsNarrow: true
 * });
 * // => { width: 6, truncated: false, ellipsed: false, index: 3 }
 * 
 * // With combining characters
 * getStringTruncatedWidth('e\u0301'); // Latin e with acute
 * // => { width: 1, truncated: false, ellipsed: false, index: 2 }
 * 
 * getStringTruncatedWidth('ก\u0e31'); // Thai character with vowel mark
 * // => { width: 1, truncated: false, ellipsed: false, index: 2 }
 * ```
 * 
 * Features:
 * - Full Unicode support including combining marks from various scripts
 * - Accurate width calculation for emoji sequences
 * - ANSI escape code handling
 * - Customizable character widths
 * - Optional string truncation with ellipsis
 * 
 * @param input - The string to calculate the width for
 * @param options - Configuration options for width calculation and truncation
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

        if (isCombiningCharacter(codePoint)) {
            // Variation Selectors
            // Combining characters should not add to width
            index += codePoint > 0xffff ? 2 : 1;
            continue;
        }

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

    if (truncationEnabled && config.truncation.limit >= config.truncation.ellipsisWidth) {
        // When truncating with ellipsis, ensure the final width includes both the truncated content
        // and the ellipsis, but doesn't exceed the limit
        finalWidth = Math.min(truncationLimit + config.truncation.ellipsisWidth, config.truncation.limit);
    }

    return {
        ellipsed: truncationEnabled && config.truncation.limit >= config.truncation.ellipsisWidth,
        index: truncationEnabled ? truncationIndex : length,
        truncated: truncationEnabled,
        width: finalWidth,
    };
};
