// eslint-disable-next-line import/no-extraneous-dependencies
import { eastAsianWidthType } from "get-east-asian-width";

import { RE_ANSI, RE_CONTROL, RE_EMOJI } from "./constants";

/**
 * Cache for storing pre-calculated character widths
 * Uses a two-level structure for memory efficiency:
 * - First level: Maps the high 16 bits of code point to a second-level map
 * - Second level: Maps the low 16 bits to actual width values
 */
const charWidthCache = new Map<number, Map<number, number>>();

/**
 * Regular expression for Latin characters with sticky flag for better performance.
 * Matches ASCII and extended Latin-1 characters, excluding variation selectors.
 */
const RE_LATIN_CHARS = /(?:[\u0020-\u007E\u00A0-\u00FF](?!\uFE0F)){1,1000}/y;

// eslint-disable-next-line sonarjs/cognitive-complexity
const getCharType = (codePoint: number): "control" | "latin" | "other" | "wide" | "zero" => {
    // ASCII printable range (most common case first for performance)
    if (codePoint >= 0x00_20 && codePoint <= 0x00_7E) {
        return "latin";
    }

    // Unicode range for Zero Width characters
    if (codePoint === 0x20_0B || codePoint === 0x20_0C || codePoint === 0x20_0D || codePoint === 0x20_60) {
        return "zero";
    }

    // Control characters
    if (codePoint <= 0x00_1F || (codePoint >= 0x00_7F && codePoint <= 0x00_9F)) {
        return "control";
    }

    // Latin-1 Supplement (also common in western text)
    if (codePoint >= 0x00_A0 && codePoint <= 0x00_FF) {
        return "latin";
    }

    // Box Drawing block (U+2500-U+257F) should be treated as width 1
    if (codePoint >= 0x25_00 && codePoint <= 0x25_7F) {
        return "latin"; // Treat as regular width 1
    }

    // Full-width and CJK characters (wide)
    if (
        (codePoint >= 0x11_00 && codePoint <= 0x11_FF) // Hangul Jamo
        || (codePoint >= 0x2E_80 && codePoint <= 0x9F_FF) // CJK & radicals
        || (codePoint >= 0xAC_00 && codePoint <= 0xD7_AF) // Hangul Syllables
        || (codePoint >= 0xF9_00 && codePoint <= 0xFA_FF) // CJK Compatibility Ideographs
        || (codePoint >= 0xFF_00 && codePoint <= 0xFF_EF && !(codePoint >= 0xFF_61 && codePoint <= 0xFF_9F)) // Full-width Forms (excluding half-width katakana)
        || (codePoint >= 0x30_40 && codePoint <= 0x30_FF) // Hiragana & Katakana
    ) {
        return "wide";
    }

    // Add check for ellipsis "…"
    if (codePoint === 0x20_26) {
        // U+2026 is the horizontal ellipsis
        return "latin"; // Treat as regular width 1
    }

    return "other";
};

type StringTruncatedWidthConfig = {
    truncation: {
        countAnsiEscapeCodes: boolean;
        ellipsis: string;
        ellipsisWidth: number;
        limit: number;
    };
    width: {
        ambiguousIsNarrow: boolean;
        ansi: number;
        control: number;
        emoji: number;
        fullWidth: number;
        halfWidth: number;
        regular: number;
        tab: number;
        wide: number;
    };
};

/**
 * Gets the width of a character from cache or calculates it using a two-level caching strategy.
 * @param codePoint Unicode code point to get width for
 * @param config Character width configuration
 * @returns The visual width of the character
 */
const getCachedCharWidth = (codePoint: number, config: StringTruncatedWidthConfig): number => {
    // Split the code point into high and low parts for efficient caching
    const highBits = Math.floor(codePoint / 65_536);
    const lowBits = codePoint % 65_536;

    // Get or create the second-level map
    let lowMap = charWidthCache.get(highBits);

    if (!lowMap) {
        lowMap = new Map();
        charWidthCache.set(highBits, lowMap);
    }

    // Check if width is already cached
    if (lowMap.has(lowBits)) {
        return lowMap.get(lowBits) as number;
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
            case "ambiguous": {
                width = config.width.ambiguousIsNarrow ? config.width.regular : config.width.wide;
                break;
            }
            case "fullwidth": {
                width = config.width.fullWidth;
                break;
            }
            case "wide": {
                width = config.width.wide;
                break;
            }
            default: {
                width = config.width.regular;
            }
        }
    }

    // Cache the result
    lowMap.set(lowBits, width);

    return width;
};

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
 * @example
 * ```typescript
 * isCombiningCharacter(0x0300); // true (combining grave accent)
 * isCombiningCharacter(0x0E31); // true (Thai vowel mark)
 * isCombiningCharacter(0x0061); // false (Latin 'a')
 * ```
 * @param codePoint The Unicode code point to check
 * @returns True if the code point is a combining character
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const isCombiningCharacter = (codePoint: number): boolean => {
    // Universal combining marks
    if (
        (codePoint >= 0x03_00 && codePoint <= 0x03_6F) // Combining Diacritical Marks
        || (codePoint >= 0x1A_B0 && codePoint <= 0x1A_FF) // Combining Diacritical Marks Extended
        || (codePoint >= 0x1D_C0 && codePoint <= 0x1D_FF) // Combining Diacritical Marks Supplement
        || (codePoint >= 0x20_D0 && codePoint <= 0x20_FF) // Combining Diacritical Marks for Symbols
        || (codePoint >= 0xFE_20 && codePoint <= 0xFE_2F)
    ) {
        // Combining Half Marks
        return true;
    }

    // Variation and VS selectors
    if (
        (codePoint >= 0xE_01_00 && codePoint <= 0xE_01_EF) // Variation Selectors Supplement
        || (codePoint >= 0xFE_00 && codePoint <= 0xFE_0F)
    ) {
        // Variation Selectors
        return true;
    }

    // Southeast Asian scripts
    if (
        (codePoint >= 0x0E_31 && codePoint <= 0x0E_3A) // Thai vowel marks and tone marks
        || (codePoint >= 0x0E_47 && codePoint <= 0x0E_4E) // Thai diacritics
        || (codePoint >= 0x0E_B1 && codePoint <= 0x0E_B9) // Lao vowel marks
        || (codePoint >= 0x0E_BB && codePoint <= 0x0E_BC) // Lao vowel signs
        || (codePoint >= 0x0E_C8 && codePoint <= 0x0E_CD)
    ) {
        // Lao tone marks
        return true;
    }

    // Indic scripts
    if (
        (codePoint >= 0x09_00 && codePoint <= 0x09_03) // Devanagari signs
        || (codePoint >= 0x09_3A && codePoint <= 0x09_4F) // Devanagari vowel signs and virama
        || (codePoint >= 0x09_51 && codePoint <= 0x09_57) // Devanagari stress marks
        || (codePoint >= 0x09_62 && codePoint <= 0x09_63) // Devanagari vowel signs
        || (codePoint >= 0x09_81 && codePoint <= 0x09_83) // Bengali signs
        || (codePoint >= 0x09_BC && codePoint <= 0x09_C4) // Bengali vowel signs
        || (codePoint >= 0x09_CD && codePoint <= 0x09_CD) // Bengali virama
        || (codePoint >= 0x0A_01 && codePoint <= 0x0A_03) // Gurmukhi signs
        || (codePoint >= 0x0A_3C && codePoint <= 0x0A_4D)
    ) {
        // Gurmukhi modifiers
        return true;
    }

    // Arabic and Persian
    if (
        (codePoint >= 0x06_4B && codePoint <= 0x06_5F) // Arabic diacritics
        || (codePoint >= 0x06_70 && codePoint <= 0x06_70) // Arabic letter superscript alef
        || (codePoint >= 0x06_D6 && codePoint <= 0x06_ED) // Arabic small high signs
        || (codePoint >= 0x08_E4 && codePoint <= 0x08_FE)
    ) {
        // Arabic mark extensions
        return true;
    }

    // Hebrew
    if (
        (codePoint >= 0x05_91 && codePoint <= 0x05_BD) // Hebrew points
        || (codePoint >= 0x05_BF && codePoint <= 0x05_BF) // Hebrew point rafe
        || (codePoint >= 0x05_C1 && codePoint <= 0x05_C2) // Hebrew points
        || (codePoint >= 0x05_C4 && codePoint <= 0x05_C5) // Hebrew marks
        || (codePoint >= 0x05_C7 && codePoint <= 0x05_C7)
    ) {
        // Hebrew point qamats qatan
        return true;
    }

    // Tibetan
    if (
        (codePoint >= 0x0F_35 && codePoint <= 0x0F_35) // Tibetan mark nada
        || (codePoint >= 0x0F_37 && codePoint <= 0x0F_37) // Tibetan mark nada
        || (codePoint >= 0x0F_39 && codePoint <= 0x0F_39) // Tibetan mark tsa phru
        || (codePoint >= 0x0F_71 && codePoint <= 0x0F_7E) // Tibetan vowel signs
        || (codePoint >= 0x0F_80 && codePoint <= 0x0F_84) // Tibetan vowel signs and virama
        || (codePoint >= 0x0F_86 && codePoint <= 0x0F_87)
    ) {
        // Tibetan signs
        return true;
    }

    // Vietnamese
    return (
        (codePoint >= 0x03_00 && codePoint <= 0x03_09) // Combining diacritical marks used in Vietnamese
        || (codePoint >= 0x03_23 && codePoint <= 0x03_23)
    );
};

/**
 * Configuration options for string width calculation and truncation.
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
     * Count [ambiguous width characters](https://www.unicode.org/reports/tr11/#Ambiguous) as having narrow width (count of 1 (regular)) instead of wide width (count of 2 (wide)).
     * @default false
     */
    ambiguousIsNarrow?: boolean;

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
 * Calculate the visual width of a string with optional truncation, handling various Unicode character types.
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
 * @param input The string to calculate the width for
 * @param options Configuration options for width calculation and truncation
 * @returns Result object containing:
 * - width: The calculated visual width of the string
 * - truncated: Whether the string was truncated
 * - ellipsed: Whether an ellipsis was added
 * - index: The index at which truncation occurred (if any)
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const getStringTruncatedWidth = (input: string, options: StringTruncatedWidthOptions = {}): StringTruncatedWidthResult => {
    if (!input || input.length === 0) {
        return { ellipsed: false, index: 0, truncated: false, width: 0 };
    }

    const config: StringTruncatedWidthConfig = {
        truncation: {
            countAnsiEscapeCodes: options.countAnsiEscapeCodes ?? false,
            ellipsis: options.ellipsis ?? "",
            ellipsisWidth:
                options.ellipsisWidth
                ?? (options.ellipsis
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
    const useCaching = length > 10_000; // Only use caching for very long strings

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
            // --- Check for OSC 8 Hyperlink ---
            if (input.startsWith("\u001B]8;;", index)) {
                const BELL = "\u0007";
                const OSC8_CLOSER = `\u001B]8;;${BELL}`;
                const OSC8_CLOSER_LEN = OSC8_CLOSER.length;

                const endOfParametersIndex = input.indexOf(BELL, index + 5); // Find first BELL after \u001B]8;;

                if (endOfParametersIndex === -1) {
                    // Invalid OSC8 sequence (no BELL after params), treat as normal ANSI?
                    // For now, fall through to standard ANSI handler
                } else {
                    const startOfCloserIndex = input.indexOf(OSC8_CLOSER, endOfParametersIndex + 1);

                    if (startOfCloserIndex === -1) {
                        // Invalid OSC8 sequence (no closer), treat as normal ANSI?
                        // For now, fall through to standard ANSI handler
                    } else {
                        // Valid OSC8 structure found
                        const endOfSequenceIndex = startOfCloserIndex + OSC8_CLOSER_LEN;
                        const linkText = input.slice(endOfParametersIndex + 1, startOfCloserIndex);

                        // IMPORTANT: Recursively calculate width of ONLY the link text
                        // Need to handle potential nested ANSI within linkText
                        const strippedLinkText = linkText.replace(RE_ANSI, "");

                        const linkTextWidthResult = getStringTruncatedWidth(strippedLinkText, {
                            ambiguousIsNarrow: config.width.ambiguousIsNarrow,
                            ansiWidth: config.width.ansi,
                            controlWidth: config.width.control,
                            countAnsiEscapeCodes: false, // Never count ANSI in link text width
                            ellipsis: config.truncation.ellipsis,
                            ellipsisWidth: config.truncation.ellipsisWidth,
                            emojiWidth: config.width.emoji,
                            fullWidth: config.width.fullWidth,
                            halfWidth: config.width.halfWidth,
                            limit: Math.max(0, truncationLimit - width),
                            regularWidth: config.width.regular,
                            tabWidth: config.width.tab,
                            wideWidth: config.width.wide,
                        });

                        const textWidth = linkTextWidthResult.width;

                        if (linkTextWidthResult.truncated) {
                            truncationEnabled = true;
                            truncationIndex = Math.min(truncationIndex, index); // Truncate at start of link
                        } else if (width + textWidth > truncationLimit) {
                            truncationIndex = Math.min(truncationIndex, index); // Truncate before link
                            truncationEnabled = true;

                            if (width + textWidth > config.truncation.limit) {
                                // Break immediately if absolute limit exceeded by *full* link width
                                break;
                            }
                        }

                        // Add the width of the display text only
                        width += textWidth;
                        // Advance index past the entire OSC8 sequence
                        index = endOfSequenceIndex;

                        // Break AFTER potentially setting flags and updating width/index
                        if (truncationEnabled && width >= config.truncation.limit) {
                            break;
                        }

                        continue;
                    }
                }
            }
            // If OSC8 logic didn't handle it (invalid sequence or didn't start with \u001B]8;;), fall through...

            RE_ANSI.lastIndex = index; // Use the general RE_ANSI for other codes

            // Check if the input starts with any valid ANSI sequence recognized by RE_ANSI
            if (RE_ANSI.test(input)) {
                const ansiLength = RE_ANSI.lastIndex - index;
                const ansiWidth = config.truncation.countAnsiEscapeCodes ? ansiLength : config.width.ansi;

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
        const charCode = input.codePointAt(index) as number;

        if (charCode === 0x20_0B || charCode === 0xFE_FF || (charCode >= 0x20_60 && charCode <= 0x20_64)) {
            index += 1;

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

            index += 1;

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
        if (charCode <= 0x00_1F || (charCode >= 0x00_7F && charCode <= 0x00_9F)) {
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
            index += codePoint > 0xFF_FF ? 2 : 1;

            continue;
        }

        let charWidth: number;

        if (useCaching) {
            charWidth = getCachedCharWidth(codePoint, config);
        } else {
            const charType = getCharType(codePoint);

            switch (charType) {
                case "control": {
                    charWidth = config.width.control;

                    break;
                }
                case "latin": {
                    charWidth = config.width.regular;

                    break;
                }
                case "wide": {
                    charWidth = config.width.wide;

                    break;
                }
                case "zero": {
                    charWidth = 0;

                    break;
                }
                default: {
                    const eaw = eastAsianWidthType(codePoint);

                    switch (eaw) {
                        case "ambiguous": {
                            charWidth = config.width.ambiguousIsNarrow ? config.width.regular : config.width.wide;
                            break;
                        }
                        case "fullwidth": {
                            charWidth = config.width.fullWidth;
                            break;
                        }
                        case "wide": {
                            charWidth = config.width.wide;
                            break;
                        }
                        default: {
                            charWidth = config.width.regular;
                        }
                    }
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
        index += codePoint > 0xFF_FF ? 2 : 1;
    }

    let finalWidth = width;
    let ellipsed = false;

    if (truncationEnabled && config.truncation.limit >= config.truncation.ellipsisWidth) {
        // If truncation happened AND there's space for ellipsis:
        finalWidth = config.truncation.limit;
        ellipsed = true;
    }

    return {
        ellipsed,
        index: truncationEnabled ? truncationIndex : length,
        truncated: truncationEnabled,
        width: finalWidth,
    };
};
