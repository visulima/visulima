// eslint-disable-next-line import/no-extraneous-dependencies
import emojiRegex from "emoji-regex";
// eslint-disable-next-line import/no-extraneous-dependencies
import { eastAsianWidthType } from "get-east-asian-width";

const REGEX = {
    // eslint-disable-next-line no-control-regex,regexp/no-control-character
    ANSI: /[\u001B\u009B](?:[[()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><]|]8;;.*?\u0007)/y,
    // eslint-disable-next-line no-control-regex,regexp/no-control-character
    ANSI_LINK_END: /\u001B\]8;;\u0007/y,
    // eslint-disable-next-line no-control-regex,regexp/no-control-character,regexp/no-obscure-range
    CONTROL: /[\u0000-\u0008\n-\u001F\u007F-\u009F]{1,1000}/y,
    EMOJI: emojiRegex(),
    LATIN: /(?:[\u0020-\u007E\u00A0-\u00FF](?!\uFE0F)){1,1000}/y,
    MODIFIER: /\p{M}+/gu,
    TAB: /\t{1,1000}/y,
    // Zero-width characters and default ignorable code points
    // eslint-disable-next-line no-misleading-character-class
    ZERO_WIDTH: /[\u200B\u200C\u200D\uFEFF\u2060-\u2064]/y,
} as const;

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
    fullWidthWidth?: number;

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
 * Result object returned by getStringTruncatedWidth containing width calculation and truncation details.
 *
 * @example
 * ```typescript
 * // No truncation
 * const result: StringTruncatedWidthResult = {
 *   width: 5,        // Total visual width
 *   truncated: false, // String was not truncated
 *   ellipsed: false, // No ellipsis added
 *   index: 5         // Full string length
 * };
 *
 * // With truncation
 * const result: StringTruncatedWidthResult = {
 *   width: 8,       // Width including ellipsis
 *   truncated: true, // String was truncated
 *   ellipsed: true, // Ellipsis was added
 *   index: 5        // Truncation point
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
 * This function provides detailed control over character width calculations and truncation behavior.
 *
 * Features:
 * - Handles Unicode characters (full-width, wide, ambiguous, etc.)
 * - Supports emojis and emoji sequences
 * - Processes ANSI escape codes
 * - Handles combining characters and modifiers
 * - Supports string truncation with customizable ellipsis
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
 *   fullWidthWidth: 2,
 *   ambiguousIsNarrow: true
 * }); // => { width: 6, truncated: false, ellipsed: false, index: 3 }
 * ```
 *
 * @param input - The string to calculate the width for and potentially truncate
 * @param options - Configuration options for width calculation and truncation:
 *                 - ambiguousIsNarrow: Treat ambiguous-width characters as narrow (default: false)
 *                 - ambiguousWidth: Width of ambiguous-width characters (default: 1)
 *                 - ansiWidth: Width of ANSI escape sequences (default: 0)
 *                 - controlWidth: Width of control characters (default: 0)
 *                 - countAnsiEscapeCodes: Include ANSI escape codes in width calculation (default: false)
 *                 - ellipsis: String to append when truncation occurs (default: '')
 *                 - ellipsisWidth: Width of ellipsis, auto-calculated if not provided
 *                 - emojiWidth: Width of emoji characters (default: 2)
 *                 - fullWidthWidth: Width of full-width characters (default: 2)
 *                 - limit: Maximum width limit for the string (default: Infinity)
 *                 - regularWidth: Width of regular characters (default: 1)
 *                 - tabWidth: Width of tab characters (default: 8)
 *                 - wideWidth: Width of wide characters (default: 2)
 *
 * @returns Result object containing:
 *          - width: The calculated visual width of the string
 *          - truncated: Whether the string was truncated
 *          - ellipsed: Whether an ellipsis was added
 *          - index: The index at which truncation occurred (if any)
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const getStringTruncatedWidth = (input: string, options: StringTruncatedWidthOptions = {}): StringTruncatedWidthResult => {
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
            ansi: options.ansiWidth ?? 0,
            control: options.controlWidth ?? 0,
            emoji: options.emojiWidth ?? 2,
            fullWidth: options.fullWidthWidth ?? 2,
            regular: options.regularWidth ?? 1,
            tab: options.tabWidth ?? 8,
            wide: options.wideWidth ?? 2,
        },
    } as const;

    const truncationLimit = Math.max(0, config.truncation.limit - config.truncation.ellipsisWidth);
    const { length } = input;

    let indexPrevious = 0;
    let index = 0;
    let lengthExtra = 0;
    let truncationEnabled = false;
    let truncationIndex = length;
    let unmatchedStart = 0;
    let unmatchedEnd = 0;
    let width = 0;
    let widthExtra = 0;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,no-loops/no-loops,no-restricted-syntax,no-labels
    outer: while (true) {
        if (unmatchedEnd > unmatchedStart || (index >= length && index > indexPrevious)) {
            const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrevious, index);

            lengthExtra = 0;

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const char of unmatched.replaceAll(REGEX.MODIFIER, "")) {
                const codePoint = char.codePointAt(0) ?? 0;
                const eaw = eastAsianWidthType(codePoint);

                switch (eaw) {
                    case "fullwidth": {
                        widthExtra = config.width.fullWidth;

                        break;
                    }
                    case "wide": {
                        widthExtra = config.width.wide;

                        if (width + widthExtra > truncationLimit) {
                            truncationIndex = Math.min(truncationIndex, indexPrevious + lengthExtra);
                        }

                        if (width + widthExtra > config.truncation.limit) {
                            truncationEnabled = true;
                            truncationIndex = Math.min(truncationIndex, indexPrevious + lengthExtra);
                            break;
                        }

                        break;
                    }
                    case "ambiguous": {
                        widthExtra = (options.ambiguousIsNarrow ?? false) ? config.width.regular : config.width.wide;

                        if (width + widthExtra > truncationLimit) {
                            truncationIndex = Math.min(truncationIndex, indexPrevious + lengthExtra);
                        }

                        if (width + widthExtra > config.truncation.limit) {
                            truncationEnabled = true;
                            truncationIndex = Math.min(truncationIndex, indexPrevious + lengthExtra);
                            break;
                        }

                        break;
                    }
                    case "halfwidth":
                    case "narrow":
                    case "neutral": {
                        widthExtra = config.width.regular;

                        if (width + widthExtra > truncationLimit) {
                            truncationIndex = Math.min(truncationIndex, indexPrevious + lengthExtra);
                        }

                        if (width + widthExtra > config.truncation.limit) {
                            truncationEnabled = true;
                            truncationIndex = Math.min(truncationIndex, indexPrevious + lengthExtra);
                            break;
                        }

                        break;
                    }
                    default: {
                        widthExtra = config.width.regular;
                    }
                }

                if (width + widthExtra > truncationLimit) {
                    truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrevious) + lengthExtra);
                }

                if (width + widthExtra > config.truncation.limit) {
                    truncationEnabled = true;
                    // eslint-disable-next-line no-labels
                    break outer;
                }

                lengthExtra += char.length;
                width += widthExtra;
            }

            // eslint-disable-next-line no-multi-assign
            unmatchedStart = unmatchedEnd = 0;
        }

        if (index >= length) {
            break;
        }

        REGEX.ZERO_WIDTH.lastIndex = index;

        if (REGEX.ZERO_WIDTH.test(input)) {
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.ZERO_WIDTH.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        REGEX.LATIN.lastIndex = index;

        if (REGEX.LATIN.test(input)) {
            lengthExtra = REGEX.LATIN.lastIndex - index;
            widthExtra = lengthExtra * config.width.regular;

            if (width + widthExtra > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / config.width.regular));
            }

            if (width + widthExtra > config.truncation.limit) {
                truncationEnabled = true;
                truncationIndex = Math.min(truncationIndex, index + Math.floor((config.truncation.limit - width) / config.width.regular));
                break;
            }

            width += widthExtra;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.LATIN.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        REGEX.ANSI.lastIndex = index;

        if (REGEX.ANSI.test(input)) {
            const ansiLength = REGEX.ANSI.lastIndex - index;
            const ansiWidth = options.countAnsiEscapeCodes ? ansiLength : config.width.ansi;

            if (input.slice(index, index + 4) === "\u001B]8;") {
                // Handle ANSI hyperlink
                const startPos = REGEX.ANSI.lastIndex;
                REGEX.ANSI_LINK_END.lastIndex = startPos;
                if (REGEX.ANSI_LINK_END.test(input)) {
                    const endPos = REGEX.ANSI_LINK_END.lastIndex;
                    const textContent = input.slice(startPos, endPos - 5); // -5 to exclude the end sequence
                    const textWidth = textContent.length;

                    if (width + textWidth > truncationLimit) {
                        truncationIndex = Math.min(truncationIndex, startPos);
                    }

                    if (width + textWidth > config.truncation.limit) {
                        truncationEnabled = true;
                        truncationIndex = Math.min(truncationIndex, startPos);
                        break;
                    }

                    width += textWidth;
                    index = endPos;
                    // eslint-disable-next-line no-continue
                    continue;
                }
            }

            if (width + ansiWidth > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index);
            }

            if (width + ansiWidth > config.truncation.limit) {
                truncationEnabled = true;
                truncationIndex = Math.min(truncationIndex, index);
                break;
            }

            width += ansiWidth;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.ANSI.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        REGEX.CONTROL.lastIndex = index;

        if (REGEX.CONTROL.test(input)) {
            lengthExtra = REGEX.CONTROL.lastIndex - index;
            widthExtra = lengthExtra * config.width.control;

            if (width + widthExtra > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / config.width.control));
            }

            if (width + widthExtra > config.truncation.limit) {
                truncationEnabled = true;
                truncationIndex = Math.min(truncationIndex, index + Math.floor((config.truncation.limit - width) / config.width.control));
                break;
            }

            width += widthExtra;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.CONTROL.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        REGEX.TAB.lastIndex = index;

        if (REGEX.TAB.test(input)) {
            lengthExtra = REGEX.TAB.lastIndex - index;
            widthExtra = lengthExtra * config.width.tab;

            if (width + widthExtra > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / config.width.tab));
            }

            if (width + widthExtra > config.truncation.limit) {
                truncationEnabled = true;
                truncationIndex = Math.min(truncationIndex, index + Math.floor((config.truncation.limit - width) / config.width.tab));
                break;
            }

            width += widthExtra;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.TAB.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        REGEX.EMOJI.lastIndex = index;

        if (REGEX.EMOJI.test(input)) {
            if (width + config.width.emoji > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index);
            }

            if (width + config.width.emoji > config.truncation.limit) {
                truncationEnabled = true;
                truncationIndex = Math.min(truncationIndex, index);
                break;
            }

            width += config.width.emoji;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.EMOJI.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        index += 1;
    }

    if (truncationEnabled) {
        width = 0;
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let index_ = 0;

        // eslint-disable-next-line no-loops/no-loops
        while (index_ < truncationIndex) {
            const char = input.slice(index_);
            let charWidth = 0;
            let charLength = 1;

            REGEX.ANSI.lastIndex = 0;
            if (REGEX.ANSI.test(char)) {
                charLength = REGEX.ANSI.lastIndex;
                index_ += charLength;
                // eslint-disable-next-line no-continue
                continue;
            }

            if (REGEX.EMOJI.test(char)) {
                charWidth = options.emojiWidth ?? 2;
                charLength = REGEX.EMOJI.lastIndex;
            } else if (REGEX.CONTROL.test(char)) {
                charWidth = (options.controlWidth ?? 0) * REGEX.CONTROL.lastIndex;
                charLength = REGEX.CONTROL.lastIndex;
            } else if (REGEX.TAB.test(char)) {
                charWidth = (options.tabWidth ?? 8) * REGEX.TAB.lastIndex;
                charLength = REGEX.TAB.lastIndex;
            } else {
                const codePoint = char.codePointAt(0) ?? 0;
                const eaw = eastAsianWidthType(codePoint);
                charLength = String.fromCodePoint(codePoint).length;

                switch (eaw) {
                    case "fullwidth": {
                        charWidth = options.fullWidthWidth ?? 2;
                        break;
                    }
                    case "wide": {
                        charWidth = options.wideWidth ?? 2;
                        break;
                    }
                    case "ambiguous": {
                        charWidth = (options.ambiguousIsNarrow ?? false) ? (options.regularWidth ?? 1) : (options.wideWidth ?? 2);
                        break;
                    }
                    default: {
                        charWidth = options.regularWidth ?? 1;
                    }
                }
            }

            if (width + charWidth + config.truncation.ellipsisWidth > config.truncation.limit) {
                truncationIndex = index_;
                break;
            }

            width += charWidth;
            index_ += charLength;
        }
    }

    return {
        ellipsed: truncationEnabled && config.truncation.limit >= config.truncation.ellipsisWidth,
        index: truncationEnabled ? truncationIndex : length,
        truncated: truncationEnabled,
        width: truncationEnabled ? Math.min(width + config.truncation.ellipsisWidth, config.truncation.limit) : width,
    };
};
