/* eslint-disable jsdoc/informative-docs */

/**
 * Modified copy of https://github.com/sindresorhus/cli-truncate/blob/main/index.js
 *
 * MIT License
 * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
 */
import type { StringTruncatedWidthOptions } from "./get-string-truncated-width";
import { getStringTruncatedWidth } from "./get-string-truncated-width";
import { getStringWidth } from "./get-string-width";
import { slice } from "./slice";

// Predefined constants
const DEFAULT_ELLIPSIS = "…";
const MAX_SPACE_SEARCH_DISTANCE = 3;

/**
 * Finds the index of the nearest space character within a specified distance.
 * @param value The string to search in
 * @param startIndex The string index to start searching from (must be a valid string index, not width-based)
 * @param searchRight Direction to search (true = right, false = left)
 * @returns The index of the nearest space or the original index if no space is found
 */
const findNearestSpace = (value: string, startIndex: number, searchRight = false): number => {
    // Early return if already at a space
    if (value.charAt(startIndex) === " ") {
        return startIndex;
    }

    const direction = searchRight ? 1 : -1;
    const limit = Math.min(MAX_SPACE_SEARCH_DISTANCE, searchRight ? value.length - startIndex : startIndex);

    // eslint-disable-next-line no-plusplus
    for (let offset = 1; offset <= limit; offset++) {
        const index = startIndex + offset * direction;

        if (value.charAt(index) === " ") {
            return index;
        }
    }

    return startIndex;
};

/**
 * Converts a width-based position to a string index.
 * @param input The string to convert width for
 * @param targetWidth The target width position
 * @param widthOptions Width calculation options
 * @returns The string index corresponding to the target width
 */
const widthToIndex = (input: string, targetWidth: number, widthOptions?: TruncateOptions["width"]): number => {
    const result = getStringTruncatedWidth(input, {
        ...widthOptions,
        ellipsis: "",
        ellipsisWidth: 0,
        limit: targetWidth,
    });

    return result.index;
};

/**
 * Converts a string index to a width position.
 * @param input The string to convert width for
 * @param stringIndex The string index to convert
 * @param widthOptions Width calculation options
 * @returns The width position corresponding to the string index
 */
const indexToWidth = (input: string, stringIndex: number, widthOptions?: TruncateOptions["width"]): number =>
    getStringWidth(input.slice(0, stringIndex), widthOptions);

export type TruncateOptions = {
    /**
     * Text appended to the string when it is truncated
     * @default '…'
     */
    ellipsis?: string;

    /**
     * Width of the ellipsis string
     * If not provided, it will be calculated using getStringTruncatedWidth
     */
    ellipsisWidth?: number;

    /**
     * The position to truncate the string.
     * @default 'end'
     */
    position?: "end" | "middle" | "start";

    /**
     * Truncate the string from a whitespace if it is within 3 characters from the actual breaking point.
     * @default false
     */
    preferTruncationOnSpace?: boolean;

    /**
     * Width calculation options
     */
    width?: Omit<StringTruncatedWidthOptions, "ellipsis" | "ellipsisWidth" | "limit">;
};

/**
 * Truncates a string to a specified width limit, handling Unicode characters, ANSI escape codes,
 * and adding an optional ellipsis.
 *
 * ANSI Sequence Handling:
 * - Valid ANSI sequences (e.g. '\u001b[31m') are preserved and handled as styling
 * - Incomplete sequences are preserved as-is
 * - Missing terminators are preserved as-is
 * @example
 * ```typescript
 * // Basic usage
 * truncate('Hello World', 5); // 'Hello…'
 *
 * // With valid ANSI styling
 * truncate('\u001b[31mRed\u001b[0m Text', 3); // '\u001b[31mRed\u001b[0m…'
 *
 * // With invalid ANSI sequence
 * truncate('\u001b[abcText', 4); // '\u001b[abcText'
 * ```
 * @param input The string to truncate
 * @param limit Maximum width of the returned string
 * @param options Configuration options for truncation
 * @returns The truncated string with ellipsis if applicable
 */

export const truncate = (input: string, limit: number, options: TruncateOptions = {}): string => {
    // Input validation
    if (typeof input !== "string") {
        throw new TypeError(`Expected \`input\` to be a string, got ${typeof input}`);
    }

    if (typeof limit !== "number") {
        throw new TypeError(`Expected \`limit\` to be a number, got ${typeof limit}`);
    }

    // Fast path for empty strings or tiny limits
    if (input === "" || limit <= 0) {
        return "";
    }

    const normalizedInput = input.normalize("NFC");

    // Destructure options with defaults
    const { ellipsis = DEFAULT_ELLIPSIS, position = "end", preferTruncationOnSpace = false } = options;

    // Calculate or use provided ellipsis width
    let ellipsisWidth: number | undefined = (options.ellipsisWidth ?? ellipsis === DEFAULT_ELLIPSIS) ? 1 : undefined;

    ellipsisWidth ??= getStringTruncatedWidth(ellipsis, {
        ...options.width,
        ellipsis: "",
        ellipsisWidth: 0,
        limit: Number.POSITIVE_INFINITY,
    }).width;

    // Get the total width of the input string
    const { width } = getStringTruncatedWidth(normalizedInput, {
        ...options.width,
        ellipsis,
        ellipsisWidth,
    });

    // No truncation needed if string fits within limit
    if (width <= limit) {
        return normalizedInput;
    }

    // Handle different truncation positions
    switch (position) {
        case "end": {
            if (preferTruncationOnSpace) {
                const targetWidth = limit - ellipsisWidth;
                const stringIndex = widthToIndex(normalizedInput, targetWidth, options.width);
                const nearestSpace = findNearestSpace(normalizedInput, stringIndex);
                const nearestSpaceWidth = indexToWidth(normalizedInput, nearestSpace, options.width);

                return (
                    slice(normalizedInput, 0, nearestSpaceWidth, {
                        width: options.width,
                    }) + ellipsis
                );
            }

            return (
                slice(normalizedInput, 0, limit - ellipsisWidth, {
                    width: options.width,
                }) + ellipsis
            );
        }

        case "middle": {
            const half = Math.floor(limit / 2);
            const totalTextWidth = Math.max(0, limit - ellipsisWidth);
            const leftWidth = Math.min(half, totalTextWidth);
            const rightWidth = Math.max(0, totalTextWidth - leftWidth);

            if (preferTruncationOnSpace) {
                const firstBreakIndex = widthToIndex(normalizedInput, leftWidth, options.width);
                const firstBreak = findNearestSpace(normalizedInput, firstBreakIndex);
                const firstBreakWidth = indexToWidth(normalizedInput, firstBreak, options.width);
                const secondBreakWidthTarget = width - rightWidth;
                const secondBreakIndex = widthToIndex(normalizedInput, secondBreakWidthTarget, options.width);
                const secondBreak = findNearestSpace(normalizedInput, secondBreakIndex, true);
                const secondBreakWidthActual = indexToWidth(normalizedInput, secondBreak, options.width);

                return (
                    slice(normalizedInput, 0, firstBreakWidth, { width: options.width }) +
                    ellipsis +
                    slice(normalizedInput, secondBreakWidthActual, width, { width: options.width }).trim()
                );
            }

            return (
                slice(normalizedInput, 0, leftWidth, {
                    width: options.width,
                }) +
                ellipsis +
                slice(normalizedInput, width - rightWidth, width, {
                    width: options.width,
                })
            );
        }

        case "start": {
            if (preferTruncationOnSpace) {
                const targetWidth = width - limit + ellipsisWidth;
                const stringIndex = widthToIndex(normalizedInput, targetWidth, options.width);
                const nearestSpace = findNearestSpace(normalizedInput, stringIndex, true);
                const nearestSpaceWidth = indexToWidth(normalizedInput, nearestSpace, options.width);

                return ellipsis + slice(normalizedInput, nearestSpaceWidth, width, { width: options.width }).trim();
            }

            return (
                ellipsis +
                slice(normalizedInput, width - limit + ellipsisWidth, width, {
                    width: options.width,
                })
            );
        }

        default: {
            throw new Error(`Invalid position: expected 'start', 'middle' or 'end', got '${position as string}'`);
        }
    }
};
