import sliceAnsi from "slice-ansi";

/**
 * Slices a string by visible characters (ignoring ANSI escape codes)
 * and preserves (or reapplies) the ANSI codes within the sliced region.
 *
 * @param text  - The full string containing ANSI codes
 * @param start - The starting index (by visible characters)
 * @param end   - The ending index (exclusive, by visible characters)
 * @returns The sliced substring, with ANSI codes preserved
 */
export const preserveAnsiCodes = (text: string, start: number, end: number): string => {
    // Clamp invalid values
    if (start < 0) {
        start = 0;
    }

    if (end < 0) {
        end = 0;
    }

    // If slice range is invalid or zero-length, return empty string
    if (end <= start) {
        return "";
    }

    // `slice-ansi` handles the logic of slicing by visible characters
    // and preserving/reapplying any necessary ANSI codes.
    return sliceAnsi(text, start, end);
};
