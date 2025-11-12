// eslint-disable-next-line import/no-extraneous-dependencies
import emojiRegex from "emoji-regex-xs";

/**
 * ANSI escape characters
 */
export const ESCAPES: Set<string> = new Set<string>(["\u001B", "\u009B"]);

/**
 * ANSI escape bell character
 */
export const ANSI_ESCAPE_BELL: string = "\u0007";

/**
 * ANSI Control Sequence Introducer
 */
export const ANSI_CSI: string = "[";

/**
 * ANSI Select Graphic Rendition terminator
 */
export const ANSI_SGR_TERMINATOR: string = "m";

/**
 * ANSI escape sequence for hyperlinks
 */
export const ANSI_ESCAPE_LINK: string = `]8;;`;

/**
 * Default foreground color code
 */
export const END_CODE: number = 39;

/**
 * Regular expression to match zero-width characters, excluding the zero-width joiner used in emoji sequences.
 * Zero-width characters to remove, EXCLUDING zero-width joiner used in emoji
 */
export const RE_ZERO_WIDTH: RegExp = /[\u200B\uFEFF\u2060-\u2064]/g;

/**
 * RegExp pattern for ANSI escape sequences
 * Compiled once for better performance
 */
export const RE_ESCAPE_PATTERN: RegExp = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`);

/**
 * Map of ANSI style codes to their reset codes
 * Used to properly reset styles when needed
 */
export const ANSI_RESET_CODES: Map<number, number> = Object.freeze(
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
export const RE_LEADING_NEWLINE: RegExp = /^[ \t]*(?:\r\n|\r|\n)/;

/** Regular expression to match trailing newlines and surrounding whitespace. */
export const RE_TRAILING_NEWLINE: RegExp = /(?:\r\n|\r|\n)[ \t]*$/;

/** Regular expression to match strings that start with a newline or are empty. */
export const RE_STARTS_WITH_NEWLINE_OR_IS_EMPTY: RegExp = /^(?:[\r\n]|$)/;

/** Regular expression to detect indentation after a newline. Captures the indentation whitespace. */
export const RE_DETECT_INDENTATION: RegExp = /(?:\r\n|\r|\n)([ \t]*)(?:[^ \t\r\n]|$)/;

/** Regular expression to match strings containing only whitespace but at least one newline character. */
export const RE_ONLY_WHITESPACE_WITH_AT_LEAST_ONE_NEWLINE: RegExp = /^[ \t]*[\r\n][ \t\r\n]*$/;

/** Regular expression to match various newline sequences (CRLF, LF, CR). */
export const RE_MATCH_NEWLINES: RegExp = /\r\n|\n|\r/g;

/**
 * Regular expression for ANSI escape sequences
 * Used for parsing and handling ANSI color codes and formatting
 */
// eslint-disable-next-line no-control-regex, sonarjs/regex-complexity, sonarjs/no-control-regex
export const RE_ANSI: RegExp = /[\u001B\u009B](?:[[()#;?]{0,10}(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><]|\]8;;[^\u0007\u001B]{0,100}(?:\u0007|\u001B\\))/g;

/**
 * Regular expression for valid ANSI color/style sequences with proper open/close pairs
 * Matches sequences like '\u001B[31mtext\u001B[39m'
 */
// eslint-disable-next-line no-control-regex, sonarjs/regex-complexity, sonarjs/no-control-regex
export const RE_VALID_ANSI_PAIRS: RegExp = /\u001B\[(\d+(?:;\d+)*)?m[^\u001B]*(?:\u001B\[(?:\d+(?:;\d+)*)?m|$)/g;

// Matches OSC 8 hyperlinks and captures the *text* part (group 1)
// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
export const RE_VALID_HYPERLINKS: RegExp = /\u001B\]8;[^\u0007\u001B]*(?:\u0007|\u001B\\)(.*?)\u001B\]8;;(?:\u0007|\u001B\\)/g;

/**
 * Regular expression for control characters
 */
// eslint-disable-next-line no-control-regex, regexp/no-obscure-range, sonarjs/no-control-regex
export const RE_CONTROL: RegExp = /[\u0000-\u0008\n-\u001F\u007F-\u009F]{1,1000}/y;

/**
 * Regular expression for emoji characters
 */
export const RE_EMOJI: RegExp = emojiRegex();

/**
 * Regular expression for separators used in case conversion
 */
export const RE_SEPARATORS: RegExp = /[-_./\s]+/g;

/**
 * Fast ANSI regex for quick checks
 */
// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
export const RE_FAST_ANSI: RegExp = /(\u001B\[[0-9;]*[a-z])/i;

/** Regular expression to match characters belonging to the Arabic script. */
export const RE_ARABIC: RegExp = /\p{Script=Arabic}/u;

/** Regular expression to match characters belonging to the Bengali script. */
export const RE_BENGALI: RegExp = /\p{Script=Bengali}/u;

/** Regular expression to match characters belonging to the Cyrillic script. */
export const RE_CYRILLIC: RegExp = /\p{Script=Cyrillic}/u;

/** Regular expression to match characters belonging to the Devanagari script. */
export const RE_DEVANAGARI: RegExp = /\p{Script=Devanagari}/u;

/** Regular expression to match characters belonging to the Ethiopic script. */
export const RE_ETHIOPIC: RegExp = /\p{Script=Ethiopic}/u;
// Precompiled regex patterns for Greek script handling

/** Regular expression to match characters belonging to the Greek script. */
export const RE_GREEK: RegExp = /\p{Script=Greek}/u;

/** Regular expression to split a string by segments of Greek, Latin, or other characters. */
export const RE_GREEK_LATIN_SPLIT: RegExp = /\p{Script=Greek}+|\p{Script=Latin}+|[^\p{Script=Greek}\p{Script=Latin}]+/gu;

/** Regular expression to match characters belonging to the Gujarati script. */
export const RE_GUJARATI: RegExp = /\p{Script=Gujarati}/u;

/** Regular expression to match characters belonging to the Gurmukhi script. */
export const RE_GURMUKHI: RegExp = /\p{Script=Gurmukhi}/u;

/** Regular expression to match characters belonging to the Hangul script. */
export const RE_HANGUL: RegExp = /\p{Script=Hangul}/u;

/** Regular expression to match characters belonging to the Hebrew script. */
export const RE_HEBREW: RegExp = /\p{Script=Hebrew}/u;

/** Regular expression to match characters belonging to the Hiragana script. */
export const RE_HIRAGANA: RegExp = /\p{Script=Hiragana}/u;

/** Regular expression to match characters belonging to the Han (Kanji) script. */
export const RE_KANJI: RegExp = /\p{Script=Han}/u;

/** Regular expression to match characters belonging to the Kannada script. */
export const RE_KANNADA: RegExp = /\p{Script=Kannada}/u;

/** Regular expression to match characters belonging to the Katakana script. */
export const RE_KATAKANA: RegExp = /\p{Script=Katakana}/u;

/** Regular expression to match characters belonging to the Khmer script. */
export const RE_KHMER: RegExp = /\p{Script=Khmer}/u;

/** Regular expression to match characters belonging to the Lao script. */
export const RE_LAO: RegExp = /\p{Script=Lao}/u;

/** Regular expression to match characters belonging to the Latin script. */
export const RE_LATIN: RegExp = /\p{Script=Latin}/u;

/** Regular expression to match characters belonging to the Malayalam script. */
export const RE_MALAYALAM: RegExp = /\p{Script=Malayalam}/u;

/** Regular expression to match characters belonging to the Myanmar script. */
export const RE_MYANMAR: RegExp = /\p{Script=Myanmar}/u;

/** Regular expression to match characters belonging to the Oriya script. */
export const RE_ORIYA: RegExp = /\p{Script=Oriya}/u;

/** Regular expression to match characters belonging to the Sinhala script. */
export const RE_SINHALA: RegExp = /\p{Script=Sinhala}/u;

/** Regular expression to match characters belonging to the Tamil script. */
export const RE_TAMIL: RegExp = /\p{Script=Tamil}/u;

/** Regular expression to match characters belonging to the Telugu script. */
export const RE_TELUGU: RegExp = /\p{Script=Telugu}/u;

/** Regular expression to match characters belonging to the Thai script. */
export const RE_THAI: RegExp = /\p{Script=Thai}/u;

/** Regular expression to match characters belonging to the Tibetan script. */
export const RE_TIBETAN: RegExp = /\p{Script=Tibetan}/u;
// Special modifiers for Uzbek Latin script

/** Regular expression to match special modifier characters used in the Uzbek Latin script. */
export const RE_UZBEK_LATIN_MODIFIER: RegExp = /[\u02BB\u02BC\u0027]/u;

/**
 * Strips emoji characters from a string.
 * @param stringValue The string to strip emoji from
 * @returns The string without emoji characters
 */
export const stripEmoji: (stringValue: string) => string = (stringValue: string): string => stringValue.replace(RE_EMOJI, "");
