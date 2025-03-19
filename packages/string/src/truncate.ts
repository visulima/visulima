/**
 * Modified copy of https://github.com/sindresorhus/cli-truncate/blob/main/index.js
 *
 * MIT License
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 */
import type { StringTruncatedWidthOptions } from "./get-string-truncated-width";
import { getStringTruncatedWidth } from "./get-string-truncated-width";
import { slice } from "./slice";

const getIndexOfNearestSpace = (string: string, wantedIndex: number, shouldSearchRight = false): number => {
    if (string.charAt(wantedIndex) === " ") {
        return wantedIndex;
    }

    const direction = shouldSearchRight ? 1 : -1;

    for (let index = 0; index <= 3; index++) {
        const finalIndex = wantedIndex + index * direction;

        if (string.charAt(finalIndex) === " ") {
            return finalIndex;
        }
    }

    return wantedIndex;
};

export type TruncateOptions = {
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
     * The position to truncate the string.
     *
     * @default 'end'
     */
    position?: "end" | "middle" | "start";

    /**
     * Truncate the string from a whitespace if it is within 3 characters from the actual breaking point.
     *
     * @default false
     *
     * @example
     * ```
     * import { truncate } from '@visulima/string';
     *
     * truncate('unicorns rainbow dragons', 20, {position: 'start', preferTruncationOnSpace: true});
     * //=> '…rainbow dragons'
     *
     * truncate('unicorns rainbow dragons', 20, {position: 'middle', preferTruncationOnSpace: true});
     * //=> 'unicorns…dragons'
     *
     * truncate('unicorns rainbow dragons', 6, {position: 'end', preferTruncationOnSpace: true});
     * //=> 'unico…'
     * ```
     */
    preferTruncationOnSpace?: boolean;

    /**
     * Width calculation options
     */
    width?: Omit<StringTruncatedWidthOptions, "ellipsis" | "ellipsisWidth" | "limit">;
};

/**
 * Truncates a string to a specified width limit, handling Unicode characters, ANSI escape codes,
 * and adding an optional ellipsis. This is a convenience wrapper around getStringTruncatedWidth
 * that returns only the truncated string content.
 *
 * Features:
 * - Handles Unicode characters (full-width, wide, ambiguous, etc.)
 * - Processes ANSI escape codes
 * - Handles combining characters and modifiers
 * - Supports string truncation with customizable ellipsis
 *
 * @example
 * ```typescript
 * // Basic usage
 * truncate('hello world', 8, { ellipsis: '...' }); // => 'hello...'
 *
 * // With ANSI colors
 * truncate('\u001B[31mhello world\u001B[39m', 8, { ellipsis: '...' }); // => '\u001B[31mhello...\u001B[39m'
 *
 * // With Unicode characters
 * truncate('あいうえお', 8, { fullWidth: 2 }); // => 'あいう...'
 * ```
 *
 * @param input - The string to truncate
 * @param options - Configuration options for width calculation and truncation
 * @returns The truncated string with ellipsis if applicable
 */
export const truncate = (input: string, limit: number, options: TruncateOptions = {}): string => {
    const defaultEllipsis = "…";
    const {
        ellipsis = defaultEllipsis,
        ellipsisWidth = getStringTruncatedWidth(options.ellipsis ?? defaultEllipsis, {
            ...options,
            ellipsis: "",
            ellipsisWidth: 0,
            limit: Number.POSITIVE_INFINITY,
        }).width,
        position = "end",
        preferTruncationOnSpace = false,
    } = options;

    if (typeof input !== "string") {
        throw new TypeError(`Expected \`input\` to be a string, got ${typeof input}`);
    }

    if (typeof limit !== "number") {
        throw new TypeError(`Expected \`limit\` to be a number, got ${typeof limit}`);
    }

    if (limit < 1) {
        return "";
    }

    if (limit === 1) {
        return "";
    }

    const { width } = getStringTruncatedWidth(input, { ...options.width, ellipsis, ellipsisWidth: options.ellipsisWidth });

    if (width <= limit) {
        return input;
    }

    if (position === "start") {
        if (preferTruncationOnSpace) {
            const nearestSpace = getIndexOfNearestSpace(input, width - limit + 1, true);

            return ellipsis + slice(input, nearestSpace, width).trim();
        }

        return ellipsis + slice(input, width - limit + ellipsisWidth, width);
    }

    if (position === "middle") {
        const half = Math.floor(limit / 2);

        if (preferTruncationOnSpace) {
            const spaceNearFirstBreakPoint = getIndexOfNearestSpace(input, half);
            const spaceNearSecondBreakPoint = getIndexOfNearestSpace(input, width - (limit - half) + 1, true);

            return slice(input, 0, spaceNearFirstBreakPoint) + ellipsis + slice(input, spaceNearSecondBreakPoint, width).trim();
        }

        return slice(input, 0, half) + ellipsis + slice(input, width - (limit - half) + ellipsisWidth, width);
    }

    if (position === "end") {
        if (preferTruncationOnSpace) {
            const nearestSpace = getIndexOfNearestSpace(input, limit - 1);

            return slice(input, 0, nearestSpace) + ellipsis;
        }

        return slice(input, 0, limit - ellipsisWidth) + ellipsis;
    }

    throw new Error(`Expected \`options.position\` to be either \`start\`, \`middle\` or \`end\`, got ${position}`);
};
