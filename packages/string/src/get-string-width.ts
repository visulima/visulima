import getStringTruncatedWidth from "./get-string-truncated-width";
import type { StringWidthOptions } from "./types";

/**
 * Calculate the visual width of a string
 *
 * @param input - The string to calculate the width for
 * @param options - Options for width calculation
 * @returns The calculated width of the string
 */
const getStringWidth = (input: string, options: Omit<StringWidthOptions, "limit" | "ellipsis" | "ellipsisWidth"> = {}): number => {
    return getStringTruncatedWidth(input, { ...options, ...{
        limit: Number.POSITIVE_INFINITY,
        ellipsis: "",
        ellipsisWidth: 0
    } }).width;
};

export default getStringWidth;
