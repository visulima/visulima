import { getStringTruncatedWidth } from "./get-string-truncated-width";
import type { StringTruncatedWidthOptions } from "./get-string-truncated-width";

/**
 * Configuration options for string width calculation without truncation support.
 * This type excludes truncation-related options from StringTruncatedWidthOptions.
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const options: StringWidthOptions = {};
 *
 * // Custom character widths
 * const options: StringWidthOptions = {
 *   regularWidth: 2,
 *   emojiWidth: 3,
 *   tabWidth: 4
 * };
 *
 * // Unicode handling options
 * const options: StringWidthOptions = {
 *   ambiguousIsNarrow: true,
 *   fullWidthWidth: 2,
 *   wideWidth: 2
 * };
 * ```
 */
export type StringWidthOptions = Omit<StringTruncatedWidthOptions, "ellipsis" | "ellipsisWidth" | "limit">

/**
 * Calculate the visual width of a string, taking into account Unicode characters, emojis, ANSI escape codes, and more.
 *
 * @example
 * ```typescript
 * // Basic usage
 * getStringWidth('hello'); // => 5
 * getStringWidth('👋 hello'); // => 7
 * 
 * // With options
 * getStringWidth('hello', { regularWidth: 2 }); // => 10
 * getStringWidth('あいう', { ambiguousIsNarrow: true }); // => 3
 * ```
 *
 * @param input - The string to calculate the width for
 * @param options - Configuration options for width calculation:
 *                 - ambiguousIsNarrow: Treat ambiguous-width characters as narrow (default: false)
 *                 - ambiguousWidth: Width of ambiguous-width characters (default: 1)
 *                 - ansiWidth: Width of ANSI escape sequences (default: 0)
 *                 - controlWidth: Width of control characters (default: 0)
 *                 - countAnsiEscapeCodes: Include ANSI escape codes in width calculation (default: false)
 *                 - emojiWidth: Width of emoji characters (default: 2)
 *                 - fullWidthWidth: Width of full-width characters (default: 2)
 *                 - regularWidth: Width of regular characters (default: 1)
 *                 - tabWidth: Width of tab characters (default: 8)
 *                 - wideWidth: Width of wide characters (default: 2)
 * @returns The calculated visual width of the string
 */
export const getStringWidth = (input: string, options: StringWidthOptions = {}): number =>
    getStringTruncatedWidth(input, { ...options, ellipsis: "", ellipsisWidth: 0, limit: Number.POSITIVE_INFINITY }).width;
