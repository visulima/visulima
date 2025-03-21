import type { StringTruncatedWidthOptions } from "./get-string-truncated-width";
import { getStringTruncatedWidth } from "./get-string-truncated-width";

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
 *   fullWidth: 2,
 *   wideWidth: 2
 * };
 * ```
 */
export type StringWidthOptions = Omit<StringTruncatedWidthOptions, "ellipsis" | "ellipsisWidth" | "limit">;

/**
 * Calculate the visual width of a string, taking into account Unicode characters, emojis, and ANSI escape codes.
 *
 * @example
 * ```typescript
 * // Basic usage
 * getStringWidth('hello');
 * // => 5
 *
 * getStringWidth('👋 hello');
 * // => 7
 *
 * // With custom character widths
 * getStringWidth('hello', { regularWidth: 2 });
 * // => 10
 *
 * getStringWidth('あいう', { ambiguousIsNarrow: true });
 * // => 3
 *
 * // With combining characters
 * getStringWidth('e\u0301'); // Latin e with acute
 * // => 1
 *
 * getStringWidth('\u0e01\u0e31'); // Thai character with vowel mark
 * // => 1
 * ```
 *
 * Features:
 * - Full Unicode support including combining marks
 * - Accurate width calculation for emoji sequences
 * - ANSI escape code handling
 * - Customizable character widths
 *
 * @param input - The string to calculate the width for
 * @param options - Configuration options for width calculation
 * @returns The calculated visual width of the string
 */
export const getStringWidth = (input: string, options: StringWidthOptions = {}): number =>
    getStringTruncatedWidth(input, { ...options, ellipsis: "", ellipsisWidth: 0, limit: Number.POSITIVE_INFINITY }).width;
