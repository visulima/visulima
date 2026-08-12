import { ESCAPES, RE_ZERO_WIDTH } from "./constants";
import { getStringWidth } from "./get-string-width";
import { processAnsiString } from "./utils/ansi-parser";
import preserveAnsi from "./utils/preserve-ansi";
import readControlSequence from "./utils/read-control-sequence";

const RE_SPLIT_WHITESPACE = /(?=\s)|(?<=\s)/;

/** Shared so the wrap path does not build a segmenter per call. */
const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Matches the first character that could be wide, or could combine with the one before it. */
const RE_NEEDS_SEGMENTING = /[^\u0000-\u02FF]/;
const RE_WHITESPACE_ONLY = /^\s+$/;

/**
 * Memoized single-character width lookup for the character-level wrap hot loop.
 *
 * `wrapWithBreakAtWidth` iterates the input one UTF-16 unit at a time and needs
 * the visual width of each unit. Calling {@link getStringWidth} per character
 * spins up a fresh options/config plus a result object on every call; the set of
 * distinct single characters in any real document is tiny, so memoizing the
 * width (with default options) collapses that to a single computation per unique
 * character. Behavior is identical to `getStringWidth(char)`.
 */
const singleCharWidthCache = new Map<string, number>();

const getSingleCharWidth = (char: string): number => {
    const cached = singleCharWidthCache.get(char);

    if (cached !== undefined) {
        return cached;
    }

    const charWidth = getStringWidth(char);

    singleCharWidthCache.set(char, charWidth);

    return charWidth;
};

/**
 * Splits a token so a run of wide characters can wrap.
 *
 * Word wrapping looks for whitespace, and scripts written with fullwidth characters — Chinese,
 * Japanese, Korean — do not use it. Without this, a CJK paragraph is one unbreakable token and
 * overflows its container at whatever width it happens to be. UAX #14 allows a break between two
 * ideographs, so each wide character becomes its own breakable unit and the narrow runs around it
 * stay whole.
 *
 * Segmented by grapheme cluster rather than code point: a ZWJ emoji such as a family sequence is
 * several wide code points that must never be split from each other.
 * @param token A whitespace-free token.
 * @returns The token split into breakable pieces, in order.
 */
const splitAtWideCharacters = (token: string): string[] => {
    // Segmenting is the expensive part, and most tokens cannot need it: nothing below U+0300 is
    // wide or combines with what precedes it, so such a token is always one indivisible piece.
    // Skipping the walk here is what keeps wrapping plain prose as cheap as it was before this
    // function existed.
    if (!RE_NEEDS_SEGMENTING.test(token)) {
        return [token];
    }

    const pieces: string[] = [];

    let current = "";

    for (const { segment } of graphemeSegmenter.segment(token)) {
        if (getStringWidth(segment) > 1) {
            if (current !== "") {
                pieces.push(current);
                current = "";
            }

            pieces.push(segment);

            continue;
        }

        current += segment;
    }

    if (current !== "") {
        pieces.push(current);
    }

    return pieces;
};

/**
 * Splits input into wrappable tokens: whitespace runs, words, and individual wide characters.
 * @param input The line to tokenize.
 * @returns The tokens, in order.
 */
const tokenize = (input: string): string[] =>
    input.split(RE_SPLIT_WHITESPACE).flatMap((token) => {
        if (token === "" || RE_WHITESPACE_ONLY.test(token)) {
            return [token];
        }

        return splitAtWideCharacters(token);
    });

/**
 * Trims spaces from a string's right side while preserving ANSI sequences.
 * @param string The string to trim
 * @returns The trimmed string
 */
const stringVisibleTrimSpacesRight = (string: string): string => {
    const words = string.split(" ");

    let last = words.length;

    while (last > 0 && getStringWidth(words[last - 1] as string) === 0) {
        // eslint-disable-next-line no-plusplus
        last--;
    }

    if (last === words.length) {
        return string;
    }

    return words.slice(0, last).join(" ") + words.slice(last).join("");
};

/**
 * Wraps text based on the breakAtWidth option using precise character-level control with proper ANSI sequence handling.
 * @param string The string to wrap
 * @param width Maximum width
 * @param trim Whether to trim whitespace
 * @returns Array of wrapped lines
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const wrapWithBreakAtWidth = (string: string, width: number, trim: boolean): string[] => {
    // Fast path for empty strings
    if (string.length === 0) {
        return [""];
    }

    // Fast path for width of 0 or less
    if (width <= 0) {
        return [string];
    }

    const rows: string[] = [];

    let currentLine = "";
    let currentWidth = 0;

    // For each character in the input string
    let index = 0;

    while (index < string.length) {
        // Read a full code point (not a lone UTF-16 unit) so astral characters
        // such as emoji are never split across a wrap boundary into surrogates.
        const codePoint = string.codePointAt(index) as number;
        const char = String.fromCodePoint(codePoint);
        const charLength = char.length;

        // Escape sequences carry no width; copy them through whole. Reading the sequence rather
        // than scanning ahead for a terminator keeps a non-SGR sequence (CSI 1 D) from swallowing
        // the rest of the line.
        if (ESCAPES.has(char)) {
            const sequence = readControlSequence(string, index);

            currentLine += sequence ?? char;
            index += sequence?.length ?? 1;

            continue;
        }

        const charWidth = getSingleCharWidth(char);
        const isSpace = char === " ";

        // Skip zero-width characters
        if (charWidth === 0) {
            currentLine += char;
            index += charLength;

            continue;
        }

        // If adding this character would exceed width, start a new line
        if (currentWidth + charWidth > width) {
            // Only add to rows if the current line is not empty
            // This fixes the issue with the extra newline at the beginning
            if (currentLine) {
                rows.push(currentLine);
            }

            currentLine = "";
            currentWidth = 0;

            // Handle spaces at wrap points
            if (isSpace && trim) {
                // Skip all spaces when trim=true
                while (index < string.length && string[index] === " ") {
                    index += 1;
                }

                continue;
            }
        }

        // Add character to current line
        currentLine += char;
        currentWidth += charWidth;

        // If we've reached exactly the width limit, wrap
        if (currentWidth === width && index + charLength < string.length) {
            rows.push(currentLine);

            currentLine = "";
            currentWidth = 0;

            // Handle spaces after a wrap at exact width
            if (index + charLength < string.length && string[index + charLength] === " " && trim) {
                index += charLength;

                while (index < string.length && string[index] === " ") {
                    index += 1;
                }

                continue;
            }
        }

        index += charLength;
    }

    // Add the final line if not empty
    if (currentLine) {
        rows.push(currentLine);
    }

    // Apply trim on the right side of each line if needed
    return trim ? rows.map((element) => stringVisibleTrimSpacesRight(element)) : rows;
};

/**
 * Wraps text character by character (word boundaries ignored)
 * with proper handling of spaces when trim=false
 * @param string The string to wrap
 * @param width Maximum width
 * @param trim Whether to trim whitespace
 * @returns Array of wrapped lines
 */

const wrapCharByChar = (string: string, width: number, trim: boolean): string[] => {
    // Handle empty string
    if (string.length === 0) {
        return [];
    }

    // Trim the input if needed
    const inputToProcess = trim ? string.trim() : string;

    if (inputToProcess.length === 0) {
        return [];
    }

    const rows: string[] = [];
    let currentLine = "";
    let currentWidth = 0;

    // Process string character by character
    processAnsiString(inputToProcess, {
        getWidth: getStringWidth,
        // eslint-disable-next-line sonarjs/cognitive-complexity,sonarjs/no-invariant-returns
        onSegment: (segment) => {
            const segText = segment.text ?? "";

            if (segment.isEscapeSequence) {
                currentLine += segText;
            } else {
                const isSpace = segText === " ";

                // Skip zero-width characters
                if (segment.width === 0) {
                    currentLine += segText;

                    return true;
                }

                // Check if we need to wrap
                if (currentWidth + segment.width > width) {
                    if (currentLine) {
                        rows.push(currentLine);
                    }

                    currentLine = "";
                    currentWidth = 0;

                    // Special handling for spaces at wrap points
                    if (isSpace) {
                        // Skip spaces when trim=true
                        if (trim) {
                            return true;
                        }

                        // For trim=false, space gets its own line

                        rows.push(segText);

                        return true;
                    }
                }

                currentLine += segText;
                currentWidth += segment.width;
            }

            return true;
        },
    });

    // Add final line if not empty
    if (currentLine) {
        rows.push(currentLine);
    }

    return trim ? rows.map((row) => stringVisibleTrimSpacesRight(row)) : rows;
};

/**
 * Wraps text respecting word boundaries with proper ANSI escape sequence handling.
 * @param string The string to wrap
 * @param width Maximum width
 * @param trim Whether to trim whitespace
 * @returns Array of wrapped lines
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const wrapWithWordBoundaries = (string: string, width: number, trim: boolean): string[] => {
    // Quick return for empty string
    if (string.length === 0) {
        return [];
    }

    // Trim the input if needed
    const inputToProcess = trim ? string.trim() : string;

    if (inputToProcess.length === 0) {
        return [];
    }

    // Split by space but preserve ANSI escape sequences
    // This is crucial for the test case with "\u001B[1D" between words
    const tokens = tokenize(inputToProcess);
    const rows: string[] = [];

    let currentLine = "";
    let currentWidth = 0;
    let index = 0;

    // Process each token (word or space)
    while (index < tokens.length) {
        const token = tokens[index] as string;
        const isSpace = RE_WHITESPACE_ONLY.test(token);
        const tokenVisibleWidth = getStringWidth(token);

        // Skip empty tokens
        if (token.length === 0) {
            index += 1;

            continue;
        }

        // Skip leading spaces if trim is true and we're at line start
        if (trim && isSpace && currentWidth === 0) {
            index += 1;

            continue;
        }

        // Check if adding this token would exceed width
        if (currentWidth + tokenVisibleWidth > width && currentWidth > 0) {
            if (trim) {
                rows.push(stringVisibleTrimSpacesRight(currentLine));
            } else {
                rows.push(currentLine);
            }

            // Reset for new line
            currentLine = "";
            currentWidth = 0;

            // Don't increment i - process this token again for the new line

            continue;
        }

        currentLine += token;
        currentWidth += tokenVisibleWidth;

        index += 1;
    }

    // Add final line if not empty
    if (currentLine) {
        if (trim) {
            rows.push(stringVisibleTrimSpacesRight(currentLine));
        } else {
            rows.push(currentLine);
        }
    }

    return rows;
};

/**
 * Wraps text respecting word boundaries. If a word is longer than the width, it will be broken.
 * @param string The string to wrap
 * @param width Maximum width
 * @param trim Whether to trim whitespace
 * @returns Array of wrapped lines
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const wrapAndBreakWords = (string: string, width: number, trim: boolean): string[] => {
    if (string.length === 0) {
        return [];
    }

    const inputToProcess = trim ? string.trim() : string;

    if (inputToProcess.length === 0) {
        return [];
    }

    const tokens = tokenize(inputToProcess);
    const rows: string[] = [];

    let currentLine = "";
    let currentWidth = 0;
    let index = 0;

    while (index < tokens.length) {
        const token = tokens[index] as string;
        const isSpace = RE_WHITESPACE_ONLY.test(token);
        const tokenVisibleWidth = getStringWidth(token);

        if (token.length === 0) {
            index += 1;
            continue;
        }

        if (trim && isSpace && currentWidth === 0) {
            index += 1;
            continue;
        }

        // If the token itself is wider than the line width
        if (tokenVisibleWidth > width) {
            if (currentLine) {
                // Push any existing line before processing the long token
                rows.push(trim ? stringVisibleTrimSpacesRight(currentLine) : currentLine);
            }

            const brokenLines = wrapWithBreakAtWidth(token, width, trim);

            if (brokenLines.length > 0) {
                for (let brokenLineIndex = 0; brokenLineIndex < brokenLines.length - 1; brokenLineIndex += 1) {
                    rows.push(brokenLines[brokenLineIndex] as string);
                }

                currentLine = brokenLines.at(-1) as string;
                currentWidth = getStringWidth(currentLine);
            } else {
                currentLine = ""; // Should not happen if tokenVisibleWidth > 0
                currentWidth = 0;
            }

            index += 1;
            continue;
        }

        // If adding this token would exceed width (and it's not the first thing on the line)
        if (currentWidth + tokenVisibleWidth > width && currentWidth > 0) {
            rows.push(trim ? stringVisibleTrimSpacesRight(currentLine) : currentLine);

            currentLine = "";
            currentWidth = 0;

            if (trim && isSpace) {
                index += 1;
                continue;
            }
        }

        currentLine += token;
        currentWidth += tokenVisibleWidth;

        index += 1;
    }

    if (currentLine) {
        rows.push(trim ? stringVisibleTrimSpacesRight(currentLine) : currentLine);
    }

    return rows;
};

/**
 * Enum representing different wrapping strategies for text
 */
export const WrapMode = {
    /**
     * Breaks words at character boundaries to fit the width
     */
    BREAK_AT_CHARACTERS: "BREAK_AT_CHARACTERS",

    /**
     * Breaks lines at word boundaries. If a word is longer than the width, it will be broken.
     */
    BREAK_WORDS: "BREAK_WORDS",

    /**
     * Preserves word boundaries, words are kept intact even if they exceed width
     */
    PRESERVE_WORDS: "PRESERVE_WORDS",

    /**
     * Enforces strict adherence to the width limit by breaking at exact width
     */
    STRICT_WIDTH: "STRICT_WIDTH",
} as const;

/**
 * Word wrap options interface with detailed documentation
 */
export interface WordWrapOptions {
    /**
     * Whether to remove zero-width characters from the string.
     * @default true
     */
    removeZeroWidthCharacters?: boolean;

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
     * Controls how text wrapping is handled at width boundaries.
     * - PRESERVE_WORDS: Words are kept intact even if they exceed width (default)
     * - BREAK_AT_CHARACTERS: Words are broken at character boundaries to fit width
     * - STRICT_WIDTH: Forces breaking exactly at width limit, always
     * - BREAK_WORDS: Breaks at word boundaries, but breaks words if they are too long
     * @default WrapMode.PRESERVE_WORDS
     */
    wrapMode?: keyof typeof WrapMode;
}

/**
 * Wraps text using multiple wrapping strategies.
 * @param string The string to wrap
 * @param options Wrapping options
 * @returns The wrapped string
 */
export const wordWrap = (string: string, options: WordWrapOptions = {}): string => {
    // Apply defaults - using destructuring for cleaner code
    const { removeZeroWidthCharacters = true, trim = true, width = 80, wrapMode = WrapMode.PRESERVE_WORDS } = options;

    // Quick return for empty string
    if (trim && string.trim() === "") {
        return "";
    }

    // Normalize string and clean up zero-width characters
    let normalizedString = string.normalize("NFC").replaceAll("\r\n", "\n");

    if (removeZeroWidthCharacters) {
        normalizedString = normalizedString.replaceAll(RE_ZERO_WIDTH, "");
    }

    const result = normalizedString.split("\n").map((line) => {
        if (trim && line.trim() === "") {
            return "";
        }

        let wrappedLines: string[];

        switch (wrapMode) {
            case WrapMode.BREAK_AT_CHARACTERS: {
                wrappedLines = wrapCharByChar(line, width, trim);
                break;
            }
            case WrapMode.BREAK_WORDS: {
                wrappedLines = wrapAndBreakWords(line, width, trim);
                break;
            }
            case WrapMode.STRICT_WIDTH: {
                wrappedLines = wrapWithBreakAtWidth(line, width, trim);
                break;
            }
            default: {
                // WrapMode.PRESERVE_WORDS
                wrappedLines = wrapWithWordBoundaries(line, width, trim);
            }
        }

        return preserveAnsi(wrappedLines);
    });

    return result.join("\n");
};
