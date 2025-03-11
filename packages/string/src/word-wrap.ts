import { stripAnsi } from "./case/utils/regex";
import { getStringWidth } from "./get-string-width";

/**
 * Enum representing different wrapping strategies for text
 */
export enum WrapMode {
    /**
     * Preserves word boundaries, words are kept intact even if they exceed width
     */
    PRESERVE_WORDS = "preserve_words",

    /**
     * Breaks words at character boundaries to fit the width
     */
    BREAK_AT_CHARACTERS = "break_at_characters",

    /**
     * Enforces strict adherence to the width limit by breaking at exact width
     */
    STRICT_WIDTH = "strict_width"
}

// Constants
const ESCAPES = new Set(["\u001B", "\u009B"]);
const END_CODE = 39;
const ANSI_ESCAPE_BELL = "\u0007";
const ANSI_CSI = "[";
const ANSI_SGR_TERMINATOR = "m";
const ANSI_ESCAPE_LINK = `]8;;`;
// Zero-width characters to remove, EXCLUDING zero-width joiner used in emoji
const ZERO_WIDTH_REGEX = /[\u200B\uFEFF\u2060-\u2064]/g;

// Use a frozen Map for better performance and immutability
const ESCAPE_CODES = Object.freeze(
    new Map([
        [0, 0],
        [1, 22],
        [2, 22],
        [3, 23],
        [4, 24],
        [7, 27],
        [8, 28],
        [9, 29],
        [30, 39],
        [31, 39],
        [32, 39],
        [33, 39],
        [34, 39],
        [35, 39],
        [36, 39],
        [37, 39],
        [40, 49],
        [41, 49],
        [42, 49],
        [43, 49],
        [44, 49],
        [45, 49],
        [46, 49],
        [47, 49],
        [90, 39],
    ]),
);

// RegExp patterns compiled once for better performance
const ESCAPE_PATTERN = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`);
const COLOR_CODE_PATTERN = /\u001B\[(\d+)m/;
const COLOR_CODES = new Set(["31", "32", "33", "34", "35", "36"]);

/**
 * Word wrap options interface with detailed documentation
 */
export interface WordWrapOptions {
    /**
     * Controls how text wrapping is handled at width boundaries.
     * - PRESERVE_WORDS: Words are kept intact even if they exceed width (default)
     * - BREAK_AT_CHARACTERS: Words are broken at character boundaries to fit width
     * - STRICT_WIDTH: Forces breaking exactly at width limit, always
     * @default WrapMode.PRESERVE_WORDS
     */
    wrapMode?: WrapMode;

    /**
     * Whether to trim whitespace from wrapped lines.
     * @default true
     */
    trim?: boolean;

    /**
     * Maximum width of each line in visible characters.
     * @default 80
     */
    width?: number;

    /**
     * When false, long words never break even if they exceed width.
     * Only affects PRESERVE_WORDS and BREAK_AT_CHARACTERS modes.
     * @default true
     */
    wordWrap?: boolean;

    /**
     * Whether to remove zero-width characters from the string.
     * @default true
     */
    removeZeroWidthCharacters?: boolean;
}

/**
 * Wraps an ANSI code in the escape sequence
 * @param code - The ANSI code to wrap
 * @returns The wrapped ANSI code
 */
const wrapAnsiCode = (code: number | string): string => {
    const escapeChar = ESCAPES.values().next().value;
    return `${escapeChar}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
};

/**
 * Wraps an ANSI hyperlink in the escape sequence
 * @param url - The URL to wrap
 * @returns The wrapped ANSI hyperlink
 */
const wrapAnsiHyperlink = (url: string): string => {
    const escapeChar = ESCAPES.values().next().value;
    return `${escapeChar}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
};

/**
 * Calculate the length of words split on spaces, ignoring ANSI escape codes
 * @param string - The string to process
 * @returns Array of word lengths
 */
const wordLengths = (string: string): number[] => {
    // Use memoization for repeated words to improve performance
    const lengthCache = new Map<string, number>();

    return string.split(" ").map((word) => {
        if (lengthCache.has(word)) {
            return lengthCache.get(word)!;
        }

        const length = getStringWidth(word);
        lengthCache.set(word, length);
        return length;
    });
};

/**
 * Trims spaces from a string's right side while preserving ANSI sequences
 * @param string - The string to trim
 * @returns The trimmed string
 */
const stringVisibleTrimSpacesRight = (string: string): string => {
    const words = string.split(" ");
    let last = words.length;

    while (last > 0 && getStringWidth(words[last - 1]) === 0) {
        last--;
    }

    if (last === words.length) {
        return string;
    }

    return words.slice(0, last).join(" ") + words.slice(last).join("");
};

/**
 * An optimized function to check if a character is inside an ANSI escape sequence
 * @param chars - Array of characters
 * @param index - Current index
 * @returns Object with isInsideEscape and isInsideLinkEscape flags
 */
const checkEscapeSequence = (
    chars: string[],
    index: number,
): {
    isInsideEscape: boolean;
    isInsideLinkEscape: boolean;
} => {
    if (!ESCAPES.has(chars[index])) {
        return { isInsideEscape: false, isInsideLinkEscape: false };
    }

    const isInsideEscape = true;
    // Check for link escape sequence
    const possibleLink = chars.slice(index + 1, index + 1 + ANSI_ESCAPE_LINK.length).join("");
    const isInsideLinkEscape = possibleLink === ANSI_ESCAPE_LINK;

    return { isInsideEscape, isInsideLinkEscape };
};

/**
 * Wrap a long word across multiple rows, handling ANSI escape codes
 * @param rows - The array of rows to add to
 * @param word - The word to wrap
 * @param columns - The maximum number of columns
 */
const wrapWord = (rows: string[], word: string, columns: number): void => {
    const characters = [...word];
    let isInsideEscape = false;
    let isInsideLinkEscape = false;
    let visible = getStringWidth(stripAnsi(rows.at(-1) ?? ""));

    for (const [index, character] of characters.entries()) {
        // Process escape sequences
        if (ESCAPES.has(character)) {
            const escapeInfo = checkEscapeSequence(characters, index);
            isInsideEscape = escapeInfo.isInsideEscape;
            isInsideLinkEscape = escapeInfo.isInsideLinkEscape;
            rows[rows.length - 1] += character;
            continue;
        }

        if (isInsideEscape) {
            rows[rows.length - 1] += character;

            if (isInsideLinkEscape) {
                if (character === ANSI_ESCAPE_BELL) {
                    isInsideEscape = isInsideLinkEscape = false;
                }
            } else if (character === ANSI_SGR_TERMINATOR) {
                isInsideEscape = false;
            }
            continue;
        }

        // Process regular characters
        const characterLength = getStringWidth(character);
        if (characterLength === 0) {
            continue;
        }

        if (visible + characterLength <= columns) {
            rows[rows.length - 1] += character;
            visible += characterLength;
        } else {
            rows.push(character);
            visible = characterLength;
        }

        if (visible === columns && index < characters.length - 1) {
            rows.push("");
            visible = 0;
        }
    }

    // Handle edge case with empty last row
    if (!visible && rows.at(-1)?.length > 0 && rows.length > 1) {
        rows[rows.length - 2] += rows.pop();
    }
};

/**
 * Tracks ANSI color state to ensure proper color continuation across line breaks
 */
class AnsiStateTracker {
    private activeEscapes: string[] = [];

    /**
     * Processes an escape sequence and updates the internal state
     * @param sequence - The escape sequence to process
     */
    processEscape(sequence: string): void {
        if (sequence.includes("[39m")) {
            // Reset color state
            this.activeEscapes = [];
        } else {
            const colorMatch = COLOR_CODE_PATTERN.exec(sequence);
            if (colorMatch && COLOR_CODES.has(colorMatch[1])) {
                this.activeEscapes.push(sequence);
            }
        }
    }

    /**
     * Gets all active escape sequences to apply to a new line
     * @returns String with all active escapes
     */
    getActiveEscapes(): string {
        return this.activeEscapes.join("");
    }
}

/**
 * Wraps text based on the breakAtWidth option using precise character-level control
 * @param string - The string to wrap
 * @param width - Maximum width
 * @param trim - Whether to trim whitespace
 * @returns Array of wrapped lines
 */
const wrapWithBreakAtWidth = (string: string, width: number, trim: boolean): string[] => {
    const characters = [...string];
    const rows: string[] = [];
    let currentLine = "";
    let currentWidth = 0;
    const ansiTracker = new AnsiStateTracker();
    let isInsideEscape = false;
    let isInsideLinkEscape = false;
    let escapeBuffer = "";

    for (let index = 0; index < characters.length; index++) {
        const char = characters[index];

        // Handle escape sequences
        if (ESCAPES.has(char)) {
            isInsideEscape = true;
            escapeBuffer = char;
            currentLine += char;

            const escapeInfo = checkEscapeSequence(characters, index);
            isInsideLinkEscape = escapeInfo.isInsideLinkEscape;
            continue;
        }

        if (isInsideEscape) {
            escapeBuffer += char;
            currentLine += char;

            if (isInsideLinkEscape) {
                if (char === ANSI_ESCAPE_BELL) {
                    isInsideEscape = isInsideLinkEscape = false;
                }
            } else if (char === ANSI_SGR_TERMINATOR) {
                isInsideEscape = false;
                ansiTracker.processEscape(escapeBuffer);
            }
            continue;
        }

        const charWidth = getStringWidth(char);
        if (charWidth === 0) {
            currentLine += char;
            continue;
        }

        // Check if we need to wrap
        if (currentWidth + charWidth > width) {
            rows.push(currentLine);
            currentLine = ansiTracker.getActiveEscapes();
            currentWidth = 0;
        }

        currentLine += char;
        currentWidth += charWidth;
    }

    // Add final line if not empty
    if (currentLine) {
        rows.push(currentLine);
    }

    // Apply trim if needed
    return trim ? rows.map((row) => stringVisibleTrimSpacesRight(row)) : rows;
};

/**
 * Wraps text character by character (word boundaries ignored)
 * @param string - The string to wrap
 * @param width - Maximum width
 * @param wordWrap - Whether word wrapping is enabled
 * @param trim - Whether to trim whitespace
 * @returns Array of wrapped lines
 */
const wrapCharByChar = (string: string, width: number, wordWrap: boolean, trim: boolean): string[] => {
    let currentLine = "";
    let currentWidth = 0;
    const rows: string[] = [];
    const characters = [...string];
    const ansiTracker = new AnsiStateTracker();
    let isInsideEscape = false;
    let isInsideLinkEscape = false;
    let escapeBuffer = "";

    for (const [index, character] of characters.entries()) {
        // Handle escape sequences
        if (ESCAPES.has(character)) {
            isInsideEscape = true;
            escapeBuffer = character;
            currentLine += character;

            const escapeInfo = checkEscapeSequence(characters, index);
            isInsideLinkEscape = escapeInfo.isInsideLinkEscape;
            continue;
        }

        if (isInsideEscape) {
            escapeBuffer += character;
            currentLine += character;

            if (isInsideLinkEscape) {
                if (character === ANSI_ESCAPE_BELL) {
                    isInsideEscape = isInsideLinkEscape = false;
                }
            } else if (character === ANSI_SGR_TERMINATOR) {
                isInsideEscape = false;
                ansiTracker.processEscape(escapeBuffer);
            }
            continue;
        }

        const charWidth = getStringWidth(character);
        if (charWidth === 0) {
            currentLine += character;
            continue;
        }

        // Check if we need to wrap
        if (currentWidth + charWidth > width && wordWrap) {
            rows.push(currentLine);
            currentLine = ansiTracker.getActiveEscapes();
            currentWidth = 0;
        }

        currentLine += character;
        currentWidth += charWidth;
    }

    // Add final line if not empty
    if (currentLine) {
        rows.push(currentLine);
    }

    return trim ? rows.map((row) => stringVisibleTrimSpacesRight(row)) : rows;
};

/**
 * Wraps text respecting word boundaries
 * @param string - The string to wrap
 * @param width - Maximum width
 * @param wordWrap - Whether word wrapping is enabled
 * @param trim - Whether to trim whitespace
 * @param breakAtWidth - Whether to break words at width limit
 * @returns Array of wrapped lines
 */
const wrapWithWordBoundaries = (
    string: string,
    width: number,
    wordWrap: boolean,
    trim: boolean
): string[] => {
    const lengths = wordLengths(string);
    const rows: string[] = [""];
    const words = string.split(" ");
    const ansiTracker = new AnsiStateTracker();

    // Pre-process words to extract and track ANSI sequences
    const processedWords = words.map((word) => {
        const result = word;
        const characters = [...word];

        let isInsideEscape = false;
        let isInsideLinkEscape = false;
        let escapeBuffer = "";

        for (const [index, char] of characters.entries()) {
            if (ESCAPES.has(char)) {
                isInsideEscape = true;
                escapeBuffer = char;
                const escapeInfo = checkEscapeSequence(characters, index);
                isInsideLinkEscape = escapeInfo.isInsideLinkEscape;
                continue;
            }

            if (isInsideEscape) {
                escapeBuffer += char;
                if (isInsideLinkEscape) {
                    if (char === ANSI_ESCAPE_BELL) {
                        isInsideEscape = isInsideLinkEscape = false;
                    }
                } else if (char === ANSI_SGR_TERMINATOR) {
                    isInsideEscape = false;
                    ansiTracker.processEscape(escapeBuffer);
                }
            }
        }

        return result;
    });

    for (const [index, word] of processedWords.entries()) {
        if (trim) {
            rows[rows.length - 1] = rows.at(-1)?.trimStart() ?? "";
        }

        let rowLength = getStringWidth(rows.at(-1) ?? "");

        if (index !== 0) {
            if (rowLength >= width && (!wordWrap || !trim)) {
                rows.push(ansiTracker.getActiveEscapes());
                rowLength = 0;
            }

            if (rowLength > 0 || !trim) {
                rows[rows.length - 1] += " ";
                rowLength++;
            }
        }

        // Handle word that's too long for the line
        if (rowLength + lengths[index] > width && rowLength > 0) {
            // If wordWrap is false, keep the word intact
            if (!wordWrap) {
                if (rowLength === 0) {
                    rows[rows.length - 1] += word;
                } else {
                    rows.push(ansiTracker.getActiveEscapes() + word);
                }
                continue;
            }

            // Start a new line with active escapes
            rows.push(ansiTracker.getActiveEscapes());
            rowLength = 0;
        }

        // Handle long word at start of line
        if (rowLength === 0 && lengths[index] > width) {
            // If wordWrap is false, keep the word intact
            if (!wordWrap) {
                rows[rows.length - 1] = word;
                continue;
            }
            // Word wrapping enabled - handle by breaking the word
            wrapWord(rows, word, width);
            continue;
        }

        // Normal case - add word to current line
        rows[rows.length - 1] += word;
    }

    return trim ? rows.map((row) => stringVisibleTrimSpacesRight(row)) : rows;
};

/**
 * Preserves ANSI escape codes when joining wrapped lines
 * @param rawLines - Array of wrapped lines
 * @returns String with preserved ANSI codes
 */
const preserveAnsi = (rawLines: string[]): string => {
    // Handle empty array case
    if (rawLines.length === 0) {
        return "";
    }

    // Optimize for single line case
    if (rawLines.length === 1) {
        return rawLines[0] as string;
    }

    let returnValue = "";
    let escapeCode: number | string | undefined;
    let escapeUrl: string | undefined;

    const preString = rawLines.join("\n");
    const pre = [...preString];
    let preStringIndex = 0;

    for (const [index, character] of pre.entries()) {
        returnValue += character;

        if (ESCAPES.has(character)) {
            const match = ESCAPE_PATTERN.exec(preString.slice(preStringIndex));
            const groups = match?.groups ?? {};

            if (groups.code !== undefined) {
                const code = Number.parseFloat(groups.code);
                escapeCode = code === END_CODE ? undefined : code;
            } else if (groups.uri !== undefined) {
                escapeUrl = groups.uri.length === 0 ? undefined : groups.uri;
            }
        }

        const code = ESCAPE_CODES.get(Number(escapeCode));

        if (pre[index + 1] === "\n") {
            if (escapeUrl) {
                returnValue += wrapAnsiHyperlink("");
            }

            if (escapeCode && code) {
                returnValue += wrapAnsiCode(code);
            }
        } else if (character === "\n") {
            if (escapeCode && code) {
                returnValue += wrapAnsiCode(escapeCode);
            }

            if (escapeUrl) {
                returnValue += wrapAnsiHyperlink(escapeUrl);
            }
        }

        preStringIndex += character.length;
    }

    return returnValue;
};

/**
 * Word wrap implementation with multiple wrapping strategies
 * @param string - The string to wrap
 * @param options - Wrapping options
 * @returns The wrapped string
 */
export const wordWrap = (string: string, options: WordWrapOptions = {}): string => {
    // Apply defaults - using destructuring for cleaner code
    const { trim = true, width = 80, wordWrap = true, wrapMode = WrapMode.PRESERVE_WORDS, removeZeroWidthCharacters = true } = options;

    // Quick return for empty string
    if (trim && string.trim() === "") {
        return "";
    }

    // Normalize string and clean up zero-width characters
    let normalizedString = String(string).normalize("NFC").replaceAll("\r\n", "\n");

    if (removeZeroWidthCharacters) {
        normalizedString = normalizedString.replaceAll(ZERO_WIDTH_REGEX, "");
    }

    // Process each line individually
    const result = normalizedString.split("\n").map((line) => {
        if (trim && line.trim() === "") {
            return "";
        }

        let wrappedLines: string[];

        // Choose wrapping strategy based on wrapMode
        if (wrapMode === WrapMode.STRICT_WIDTH) {
            wrappedLines = wrapWithBreakAtWidth(line, width, trim);
        } else if (wrapMode === WrapMode.BREAK_AT_CHARACTERS && wordWrap) {
            wrappedLines = wrapCharByChar(line, width, wordWrap, trim);
        } else {
            // In PRESERVE_WORDS mode, we pass wordWrap=false to ensure long words are never broken
            // This ensures that words exceeding width are kept intact
            wrappedLines = wrapWithWordBoundaries(line, width, false, trim);
        }

        return preserveAnsi(wrappedLines);
    });

    return result.join("\n");
};
