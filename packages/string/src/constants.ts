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
 * Regular expression to match zero-width characters, excluding the zero-width joiner used in emoji sequences.
 * Zero-width characters to remove, EXCLUDING zero-width joiner used in emoji
 */
export const RE_ZERO_WIDTH = /[\u200B\uFEFF\u2060-\u2064]/g;

/**
 * RegExp pattern for ANSI escape sequences
 * Compiled once for better performance
 */
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

/** Regular expression to match leading newlines and surrounding whitespace. */
export const RE_LEADING_NEWLINE = /^[ \t]*(?:\r\n|\r|\n)/;

/** Regular expression to match trailing newlines and surrounding whitespace. */
export const RE_TRAILING_NEWLINE = /(?:\r\n|\r|\n)[ \t]*$/;

/** Regular expression to match strings that start with a newline or are empty. */
export const RE_STARTS_WITH_NEWLINE_OR_IS_EMPTY = /^(?:[\r\n]|$)/;

/** Regular expression to detect indentation after a newline. Captures the indentation whitespace. */
export const RE_DETECT_INDENTATION = /(?:\r\n|\r|\n)([ \t]*)(?:[^ \t\r\n]|$)/;

/** Regular expression to match strings containing only whitespace but at least one newline character. */
export const RE_ONLY_WHITESPACE_WITH_AT_LEAST_ONE_NEWLINE = /^[ \t]*[\r\n][ \t\r\n]*$/;

/** Regular expression to match various newline sequences (CRLF, LF, CR). */
export const RE_MATCH_NEWLINES = /\r\n|\n|\r/g;

/**
 * Regular expression for ANSI escape sequences
 * Used for parsing and handling ANSI color codes and formatting
 */
// eslint-disable-next-line no-control-regex
export const RE_ANSI = /[\u001B\u009B](?:[[()#;?]{0,10}(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><]|\]8;;[^\u0007\u001B]{0,100}(?:\u0007|\u001B\\))/g;

/**
 * Regular expression for valid ANSI color/style sequences with proper open/close pairs
 * Matches sequences like '\u001B[31mtext\u001B[39m'
 */
// eslint-disable-next-line no-control-regex
export const RE_VALID_ANSI_PAIRS = /\u001B\[(\d+(?:;\d+)*)?m[^\u001B]*(?:\u001B\[(?:\d+(?:;\d+)*)?m|$)/g;

// Matches OSC 8 hyperlinks and captures the *text* part (group 1)
// eslint-disable-next-line no-control-regex
export const RE_VALID_HYPERLINKS = /\u001B\]8;[^\u0007\u001B]*(?:\u0007|\u001B\\)(.*?)\u001B\]8;;(?:\u0007|\u001B\\)/g;

/**
 * Regular expression for control characters
 */
// eslint-disable-next-line no-control-regex,regexp/no-obscure-range
export const RE_CONTROL = /[\u0000-\u0008\n-\u001F\u007F-\u009F]{1,1000}/y;

/**
 * Regular expression for emoji characters
 */
export const RE_EMOJI = emojiRegex();

/**
 * Regular expression for separators used in case conversion
 */
export const RE_SEPARATORS = /[-_./\s]+/g;

/**
 * Fast ANSI regex for quick checks
 */
// eslint-disable-next-line no-control-regex
export const RE_FAST_ANSI = /(\u001B\[[0-9;]*[a-z])/i;

/** Regular expression to match characters belonging to the Arabic script. */
export const RE_ARABIC = /\p{Script=Arabic}/u;

/** Regular expression to match characters belonging to the Bengali script. */
export const RE_BENGALI = /\p{Script=Bengali}/u;

/** Regular expression to match characters belonging to the Cyrillic script. */
export const RE_CYRILLIC = /\p{Script=Cyrillic}/u;

/** Regular expression to match characters belonging to the Devanagari script. */
export const RE_DEVANAGARI = /\p{Script=Devanagari}/u;

/** Regular expression to match characters belonging to the Ethiopic script. */
export const RE_ETHIOPIC = /\p{Script=Ethiopic}/u;
// Precompiled regex patterns for Greek script handling

/** Regular expression to match characters belonging to the Greek script. */
export const RE_GREEK = /\p{Script=Greek}/u;

/** Regular expression to split a string by segments of Greek, Latin, or other characters. */
export const RE_GREEK_LATIN_SPLIT = /\p{Script=Greek}+|\p{Script=Latin}+|[^\p{Script=Greek}\p{Script=Latin}]+/gu;

/** Regular expression to match characters belonging to the Gujarati script. */
export const RE_GUJARATI = /\p{Script=Gujarati}/u;

/** Regular expression to match characters belonging to the Gurmukhi script. */
export const RE_GURMUKHI = /\p{Script=Gurmukhi}/u;

/** Regular expression to match characters belonging to the Hangul script. */
export const RE_HANGUL = /\p{Script=Hangul}/u;

/** Regular expression to match characters belonging to the Hebrew script. */
export const RE_HEBREW = /\p{Script=Hebrew}/u;

/** Regular expression to match characters belonging to the Hiragana script. */
export const RE_HIRAGANA = /\p{Script=Hiragana}/u;

/** Regular expression to match characters belonging to the Han (Kanji) script. */
export const RE_KANJI = /\p{Script=Han}/u;

/** Regular expression to match characters belonging to the Kannada script. */
export const RE_KANNADA = /\p{Script=Kannada}/u;

/** Regular expression to match characters belonging to the Katakana script. */
export const RE_KATAKANA = /\p{Script=Katakana}/u;

/** Regular expression to match characters belonging to the Khmer script. */
export const RE_KHMER = /\p{Script=Khmer}/u;

/** Regular expression to match characters belonging to the Lao script. */
export const RE_LAO = /\p{Script=Lao}/u;

/** Regular expression to match characters belonging to the Latin script. */
export const RE_LATIN = /\p{Script=Latin}/u;

/** Regular expression to match characters belonging to the Malayalam script. */
export const RE_MALAYALAM = /\p{Script=Malayalam}/u;

/** Regular expression to match characters belonging to the Myanmar script. */
export const RE_MYANMAR = /\p{Script=Myanmar}/u;

/** Regular expression to match characters belonging to the Oriya script. */
export const RE_ORIYA = /\p{Script=Oriya}/u;

/** Regular expression to match characters belonging to the Sinhala script. */
export const RE_SINHALA = /\p{Script=Sinhala}/u;

/** Regular expression to match characters belonging to the Tamil script. */
export const RE_TAMIL = /\p{Script=Tamil}/u;

/** Regular expression to match characters belonging to the Telugu script. */
export const RE_TELUGU = /\p{Script=Telugu}/u;

/** Regular expression to match characters belonging to the Thai script. */
export const RE_THAI = /\p{Script=Thai}/u;

/** Regular expression to match characters belonging to the Tibetan script. */
export const RE_TIBETAN = /\p{Script=Tibetan}/u;
// Special modifiers for Uzbek Latin script

/** Regular expression to match special modifier characters used in the Uzbek Latin script. */
export const RE_UZBEK_LATIN_MODIFIER = /[\u02BB\u02BC\u0027]/u;

/**
 * Strips emoji characters from a string.
 * @param stringValue The string to strip emoji from
 * @returns The string without emoji characters
 */
export const stripEmoji = (stringValue: string): string => stringValue.replace(RE_EMOJI, "");
