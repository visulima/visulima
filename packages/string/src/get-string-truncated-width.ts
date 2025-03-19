// eslint-disable-next-line import/no-extraneous-dependencies
import { eastAsianWidthType } from "get-east-asian-width";

import { RE_ANSI, RE_ANSI_LINK_END, RE_CONTROL, RE_EMOJI, RE_MODIFIER, RE_TAB, RE_ZERO_WIDTH } from "./constants";

/**
 * Regular expression for Latin characters
 */
const RE_LATIN = /(?:[\u0020-\u007E\u00A0-\u00FF](?!\uFE0F)){1,1000}/y;

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
            ambiguousIsNarrow: options.ambiguousIsNarrow ?? false,
            ansi: options.ansiWidth ?? 0,
            control: options.controlWidth ?? 0,
            emoji: options.emojiWidth ?? 2,
            fullWidth: options.fullWidth ?? 2,
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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,no-loops/no-loops,no-restricted-syntax,no-labels,no-constant-condition
    outer: while (true) {
        if (unmatchedEnd > unmatchedStart || (index >= length && index > indexPrevious)) {
            const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrevious, index);

            lengthExtra = 0;

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const char of unmatched.replaceAll(RE_MODIFIER, "")) {
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
                        widthExtra = config.width.ambiguousIsNarrow ? config.width.regular : config.width.wide;

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

        RE_ZERO_WIDTH.lastIndex = index;

        if (RE_ZERO_WIDTH.test(input)) {
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = RE_ZERO_WIDTH.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        RE_LATIN.lastIndex = index;

        if (RE_LATIN.test(input)) {
            lengthExtra = RE_LATIN.lastIndex - index;
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
            index = indexPrevious = RE_LATIN.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        RE_ANSI.lastIndex = index;

        if (RE_ANSI.test(input)) {
            const ansiLength = RE_ANSI.lastIndex - index;
            const ansiWidth = options.countAnsiEscapeCodes ? ansiLength : config.width.ansi;

            if (input.slice(index, index + 4) === "\u001B]8;") {
                // Handle ANSI hyperlink
                const startPos = RE_ANSI.lastIndex;
                RE_ANSI_LINK_END.lastIndex = startPos;
                if (RE_ANSI_LINK_END.test(input)) {
                    const endPos = RE_ANSI_LINK_END.lastIndex;
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
            index = indexPrevious = RE_ANSI.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        RE_CONTROL.lastIndex = index;

        if (RE_CONTROL.test(input)) {
            lengthExtra = RE_CONTROL.lastIndex - index;
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
            index = indexPrevious = RE_CONTROL.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        RE_TAB.lastIndex = index;

        if (RE_TAB.test(input)) {
            lengthExtra = RE_TAB.lastIndex - index;
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
            index = indexPrevious = RE_TAB.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        RE_EMOJI.lastIndex = index;

        if (RE_EMOJI.test(input)) {
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
            index = indexPrevious = RE_EMOJI.lastIndex;

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

            RE_ANSI.lastIndex = 0;
            if (RE_ANSI.test(char)) {
                charLength = RE_ANSI.lastIndex;
                index_ += charLength;
                // eslint-disable-next-line no-continue
                continue;
            }

            if (RE_EMOJI.test(char)) {
                charWidth = config.width.emoji;
                charLength = RE_EMOJI.lastIndex;
            } else if (RE_CONTROL.test(char)) {
                charWidth = config.width.control * RE_CONTROL.lastIndex;
                charLength = RE_CONTROL.lastIndex;
            } else if (RE_TAB.test(char)) {
                charWidth = config.width.tab * RE_TAB.lastIndex;
                charLength = RE_TAB.lastIndex;
            } else {
                const codePoint = char.codePointAt(0) ?? 0;
                const eaw = eastAsianWidthType(codePoint);
                charLength = String.fromCodePoint(codePoint).length;

                switch (eaw) {
                    case "fullwidth": {
                        charWidth = config.width.fullWidth;
                        break;
                    }
                    case "wide": {
                        charWidth = config.width.wide;
                        break;
                    }
                    case "ambiguous": {
                        charWidth = config.width.ambiguousIsNarrow ? config.width.regular : config.width.wide;
                        break;
                    }
                    default: {
                        charWidth = config.width.regular;
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
