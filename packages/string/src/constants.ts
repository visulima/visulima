// eslint-disable-next-line import/no-extraneous-dependencies
import emojiRegex from "emoji-regex-xs";

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
export const RE_ZERO_WIDTH = /[\u200B\uFEFF\u2060-\u2064]/g;

/**
 * RegExp pattern for ANSI escape sequences
 * Compiled once for better performance
 */
// eslint-disable-next-line regexp/no-control-character,@rushstack/security/no-unsafe-regexp
export const RE_ESCAPE_PATTERN = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`);

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

/**
 * Regular expression for ANSI escape sequences
 * Used for parsing and handling ANSI color codes and formatting
 */
// eslint-disable-next-line no-control-regex,regexp/no-control-character,security/detect-unsafe-regex
export const RE_ANSI = /[\u001B\u009B](?:[[()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-n qry=><]|\]8;;.*?\u0007)/y;

/**
 * Regular expression for ANSI link end sequences
 */
// eslint-disable-next-line no-control-regex,regexp/no-control-character
export const RE_ANSI_LINK_END = /\u001B\]8;;\u0007/y;

/**
 * Regular expression for control characters
 */
// eslint-disable-next-line no-control-regex,regexp/no-control-character,regexp/no-obscure-range
export const RE_CONTROL = /[\u0000-\u0008\n-\u001F\u007F-\u009F]{1,1000}/y;

/**
 * Regular expression for emoji characters
 */
export const RE_EMOJI = emojiRegex();

/**
 * Regular expression for Latin characters
 */
export const RE_LATIN = /(?:[\u0020-\u007E\u00A0-\u00FF](?!\uFE0F)){1,1000}/y;

/**
 * Regular expression for Unicode modifiers
 */
export const RE_MODIFIER = /\p{M}+/gu;

/**
 * Regular expression for tab characters
 */
export const RE_TAB = /\t{1,1000}/y;
