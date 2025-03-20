/**
 * Modified copy of https://github.com/sindresorhus/cli-truncate/blob/main/index.js
 *
 * MIT License
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 */
import type { StringTruncatedWidthOptions } from "./get-string-truncated-width";
import { getStringTruncatedWidth } from "./get-string-truncated-width";
import { slice } from "./slice";

// Predefined constants
const DEFAULT_ELLIPSIS = "…";
const MAX_SPACE_SEARCH_DISTANCE = 3;

export type TruncateOptions = {
    /**
     * String to append when truncation occurs
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
     *
     * @default 'end'
     */
    position?: "end" | "middle" | "start";

    /**
     * Truncate the string from a whitespace if it is within 3 characters from the actual breaking point.
     *
     * @default false
     */
    preferTruncationOnSpace?: boolean;

    /**
     * Width calculation options
     */
    width?: Omit<StringTruncatedWidthOptions, "ellipsis" | "ellipsisWidth" | "limit">;
};

/**
 * Find the index of the nearest space character within a specified distance
 *
 * @param str - The string to search in
 * @param startIndex - The index to start searching from
 * @param searchRight - Direction to search (true = right, false = left)
 * @returns The index of the nearest space or the original index if no space is found
 */
const findNearestSpace = (string_: string, startIndex: number, searchRight = false): number => {
    // Early return if already at a space
    if (string_.charAt(startIndex) === " ") {
        return startIndex;
    }

    const direction = searchRight ? 1 : -1;
    const limit = Math.min(MAX_SPACE_SEARCH_DISTANCE, searchRight ? string_.length - startIndex : startIndex);

    for (let offset = 1; offset <= limit; offset++) {
        const index = startIndex + offset * direction;
        if (string_.charAt(index) === " ") {
            return index;
        }
    }

    return startIndex;
};

/**
 * Truncates a string to a specified width limit, handling Unicode characters, ANSI escape codes,
 * and adding an optional ellipsis.
 *
 * @param input - The string to truncate
 * @param limit - Maximum width of the returned string
 * @param options - Configuration options for truncation
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

    // Destructure options with defaults
    const { ellipsis = DEFAULT_ELLIPSIS, position = "end", preferTruncationOnSpace = false } = options;

    // Calculate or use provided ellipsis width
    const ellipsisWidth = options.ellipsisWidth
        ? options.ellipsisWidth
        : ellipsis === DEFAULT_ELLIPSIS
          ? 2
          : getStringTruncatedWidth(ellipsis, {
                ...options.width,
                ellipsis: "",
                ellipsisWidth: 0,
                limit: Number.POSITIVE_INFINITY,
            }).width;

    if (limit === 1 && ellipsisWidth === 1) {
        return ellipsis;
    } if (limit === 1) {
        return "";
    }

    // Get the total width of the input string
    const { width } = getStringTruncatedWidth(input, {
        ...options.width,
        ellipsis,
        ellipsisWidth,
    });

    // No truncation needed if string fits within limit
    if (width <= limit) {
        return input;
    }

    // Handle different truncation positions
    switch (position) {
        case "start": {
            if (preferTruncationOnSpace) {
                const nearestSpace = findNearestSpace(input, width - limit + 1, true);
                return ellipsis + slice(input, nearestSpace, width).trim();
            }
            return ellipsis + slice(input, width - limit + ellipsisWidth, width);
        }

        case "middle": {
            const half = Math.floor(limit / 2);

            if (preferTruncationOnSpace) {
                const firstBreak = findNearestSpace(input, half);
                const secondBreak = findNearestSpace(input, width - (limit - half) + 1, true);
                return slice(input, 0, firstBreak) + ellipsis + slice(input, secondBreak, width).trim();
            }

            return slice(input, 0, half) + ellipsis + slice(input, width - (limit - half) + ellipsisWidth, width);
        }

        case "end": {
            if (preferTruncationOnSpace) {
                const nearestSpace = findNearestSpace(input, limit - 1);
                return slice(input, 0, nearestSpace) + ellipsis;
            }

            return slice(input, 0, limit - ellipsisWidth) + ellipsis;
        }

        default: {
            throw new Error(`Invalid position: expected 'start', 'middle' or 'end', got '${position}'`);
        }
    }
};
