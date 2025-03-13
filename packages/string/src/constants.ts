/**
 * ANSI escape characters
 */
export const ESCAPES = new Set(["\u001B", "\u009B"]);

/**
 * ANSI escape bell character
 */
export const ANSI_ESCAPE_BELL = "\u0007";

/**
 * ANSI Control Sequence Introducer
 */
export const ANSI_CSI = "[";

/**
 * ANSI Select Graphic Rendition terminator
 */
export const ANSI_SGR_TERMINATOR = "m";

/**
 * ANSI escape sequence for hyperlinks
 */
export const ANSI_ESCAPE_LINK = `]8;;`;

/**
 * Default foreground color code
 */
export const END_CODE = 39;

/**
 * Zero-width characters to remove, EXCLUDING zero-width joiner used in emoji
 */
export const ZERO_WIDTH_REGEX = /[\u200B\uFEFF\u2060-\u2064]/g;

/**
 * RegExp pattern for ANSI escape sequences
 * Compiled once for better performance
 */
// eslint-disable-next-line regexp/no-control-character,@rushstack/security/no-unsafe-regexp
export const ESCAPE_PATTERN = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`);

/**
 * Map of ANSI style codes to their reset codes
 * Used to properly reset styles when needed
 */
export const ANSI_RESET_CODES = Object.freeze(
    new Map([
        [0, 0], // Reset all
        [1, 22], // Bold → Not bold
        [2, 22], // Dim → Not bold
        [3, 23], // Italic → Not italic
        [4, 24], // Underline → Not underline
        [7, 27], // Inverse → Not inverse
        [8, 28], // Hidden → Not hidden
        [9, 29], // Strikethrough → Not strikethrough
        [30, 39], // Foreground colors → Default foreground
        [31, 39],
        [32, 39],
        [33, 39],
        [34, 39],
        [35, 39],
        [36, 39],
        [37, 39],
        [40, 49], // Background colors → Default background
        [41, 49],
        [42, 49],
        [43, 49],
        [44, 49],
        [45, 49],
        [46, 49],
        [47, 49],
        [90, 39], // Bright foreground → Default foreground
    ]),
);

export const RE_LEADING_NEWLINE = /^[ \t]*(?:\r\n|\r|\n)/;
export const RE_TRAILING_NEWLINE = /(?:\r\n|\r|\n)[ \t]*$/;
export const RE_STARTS_WITH_NEWLINE_OR_IS_EMPTY = /^(?:[\r\n]|$)/;
export const RE_DETECT_INDENTATION = /(?:\r\n|\r|\n)([ \t]*)(?:[^ \t\r\n]|$)/;
export const RE_ONLY_WHITESPACE_WITH_AT_LEAST_ONE_NEWLINE = /^[ \t]*[\r\n][ \t\r\n]*$/;

// Precompile regular expressions to avoid recompilation during execution
export const RE_MATCH_NEWLINES = /\r\n|\n|\r/g;
