import type { StringTruncatedWidthOptions } from "./get-string-truncated-width";
import { getStringTruncatedWidth } from "./get-string-truncated-width";

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
 * truncate('hello world', { limit: 8, ellipsis: '...' }); // => 'hello...'
 *
 * // With ANSI colors
 * truncate('\u001B[31mhello world\u001B[39m', { limit: 8, ellipsis: '...' }); // => '\u001B[31mhello...\u001B[39m'
 *
 * // With Unicode characters
 * truncate('あいうえお', { limit: 8, fullWidth: 2 }); // => 'あいう...'
 * ```
 *
 * @param input - The string to truncate
 * @param options - Configuration options for width calculation and truncation
 * @returns The truncated string with ellipsis if applicable
 */
export const truncate = (input: string, options: StringTruncatedWidthOptions = {}): string => {
    return getStringTruncatedWidth(input, options).content;
};
