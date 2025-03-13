import { getStringWidth } from "./get-string-width";
import { ANSI_ESCAPE_BELL, ANSI_RESET_CODES, ANSI_SGR_TERMINATOR, END_CODE, ESCAPE_PATTERN, ESCAPES, ZERO_WIDTH_REGEX } from "./constants";
import { checkEscapeSequence, processAnsiString } from "./utils/ansi-parser";
import AnsiStateTracker from "./utils/ansi-state-tracker";
import type { AnsiSegment } from "./utils/types";
import { resetAnsiAtLineBreak, wrapAnsiCode, wrapAnsiHyperlink } from "./utils/ansi-utils";

/**
 * Trims spaces from a string's right side while preserving ANSI sequences
 * @param string - The string to trim
 * @returns The trimmed string
 */
const stringVisibleTrimSpacesRight = (string: string): string => {
    const words = string.split(" ");

    let last = words.length;

    // eslint-disable-next-line no-loops/no-loops
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
 * Wraps text based on the breakAtWidth option using precise character-level control
 * with proper ANSI sequence handling
 * @param string - The string to wrap
 * @param width - Maximum width
 * @param trim - Whether to trim whitespace
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
    const ansiTracker = new AnsiStateTracker();
    let isInsideEscape = false;
    let isInsideLinkEscape = false;
    let escapeBuffer = "";

    // For each character in the input string
    // eslint-disable-next-line no-plusplus,no-loops/no-loops
    for (let index = 0; index < string.length; index++) {
        // eslint-disable-next-line security/detect-object-injection
        const char = string[index] as string;

        // Handle escape sequences
        if (ESCAPES.has(char)) {
            isInsideEscape = true;
            escapeBuffer = char;
            currentLine += char;

            const escapeInfo = checkEscapeSequence([...string], index);
            isInsideLinkEscape = escapeInfo.isInsideLinkEscape;
            // eslint-disable-next-line no-continue
            continue;
        }

        if (isInsideEscape) {
            escapeBuffer += char;
            currentLine += char;

            if (isInsideLinkEscape) {
                if (char === ANSI_ESCAPE_BELL) {
                    // eslint-disable-next-line no-multi-assign
                    isInsideEscape = isInsideLinkEscape = false;
                }
            } else if (char === ANSI_SGR_TERMINATOR) {
                isInsideEscape = false;
                ansiTracker.processEscape(escapeBuffer);
            }
            // eslint-disable-next-line no-continue
            continue;
        }

        const charWidth = getStringWidth(char);
        const isSpace = char === " ";

        // Skip zero-width characters
        if (charWidth === 0) {
            currentLine += char;
            // eslint-disable-next-line no-continue
            continue;
        }

        // If adding this character would exceed width, start a new line
        if (currentWidth + charWidth > width) {
            // Only add to rows if the current line is not empty
            // This fixes the issue with the extra newline at the beginning
            if (currentLine) {
                rows.push(resetAnsiAtLineBreak(currentLine));
            }

            // Start a new line with active ANSI codes
            currentLine = ansiTracker.getActiveEscapes();
            currentWidth = 0;

            // Handle spaces at wrap points
            if (isSpace && trim) {
                // Skip all spaces when trim=true
                // eslint-disable-next-line no-loops/no-loops,security/detect-object-injection
                while (index < string.length && string[index] === " ") {
                    // eslint-disable-next-line no-plusplus
                    index++;
                }
                // eslint-disable-next-line no-plusplus
                index--; // Adjust for the loop increment
                // eslint-disable-next-line no-continue
                continue;
            }
        }

        // Add character to current line
        currentLine += char;
        currentWidth += charWidth;

        // If we've reached exactly the width limit, wrap
        if (currentWidth === width && index < string.length - 1) {
            rows.push(resetAnsiAtLineBreak(currentLine));

            // Start a new line with active ANSI codes
            currentLine = ansiTracker.getActiveEscapes();
            currentWidth = 0;

            // Handle spaces after a wrap at exact width
            if (index + 1 < string.length && string[index + 1] === " " && trim) {
                // eslint-disable-next-line no-plusplus
                index++;
                // eslint-disable-next-line no-loops/no-loops,security/detect-object-injection
                while (index < string.length && string[index] === " ") {
                    // eslint-disable-next-line no-plusplus
                    index++;
                }
                // eslint-disable-next-line no-plusplus
                index--; // Adjust for the loop increment
            }
        }
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
 * @param string - The string to wrap
 * @param width - Maximum width
 * @param trim - Whether to trim whitespace
 * @returns Array of wrapped lines
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
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
        onSegment: (segment: AnsiSegment, stateTracker: AnsiStateTracker) => {
            if (segment.isEscapeSequence) {
                currentLine += segment.text;
            } else {
                const isSpace = segment.text === " ";

                // Skip zero-width characters
                if (segment.width === 0) {
                    currentLine += segment.text;
                    return;
                }

                // Check if we need to wrap
                if (currentWidth + segment.width > width) {
                    // Only add the current line to rows if it's not empty
                    // This fixes the issue with leading newlines
                    if (currentLine) {
                        rows.push(resetAnsiAtLineBreak(currentLine));
                    }

                    currentLine = stateTracker.getActiveEscapes();
                    currentWidth = 0;

                    // Special handling for spaces at wrap points
                    if (isSpace) {
                        if (trim) {
                            // Skip spaces when trim=true
                            return;
                        }
                        // For trim=false, space gets its own line
                        rows.push(stateTracker.getActiveEscapes() + segment.text);
                        return;
                    }
                }

                // Add character to current line
                currentLine += segment.text;
                currentWidth += segment.width;
            }
        },
    });

    // Add final line if not empty
    if (currentLine) {
        rows.push(currentLine);
    }

    return trim ? rows.map((row) => stringVisibleTrimSpacesRight(row)) : rows;
};

/**
 * Wraps text respecting word boundaries with proper ANSI escape sequence handling
 * @param string - The string to wrap
 * @param width - Maximum width
 * @param trim - Whether to trim whitespace
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
    const tokens = inputToProcess.split(/(?=\s)|(?<=\s)/);
    const rows: string[] = [];

    let currentLine = "";
    let currentWidth = 0;
    let index = 0;

    // Process each token (word or space)
    // eslint-disable-next-line no-loops/no-loops
    while (index < tokens.length) {
        // eslint-disable-next-line security/detect-object-injection
        const token = tokens[index] as string;
        const isSpace = /^\s+$/.test(token);
        const tokenVisibleWidth = getStringWidth(token);

        // Skip empty tokens
        if (token.length === 0) {
            // eslint-disable-next-line no-plusplus
            index++;
            // eslint-disable-next-line no-continue
            continue;
        }

        // Skip leading spaces if trim is true and we're at line start
        if (trim && isSpace && currentWidth === 0) {
            // eslint-disable-next-line no-plusplus
            index++;
            // eslint-disable-next-line no-continue
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
            // eslint-disable-next-line no-continue
            continue;
        }

        currentLine += token;
        currentWidth += tokenVisibleWidth;
        // eslint-disable-next-line no-plusplus
        index++;
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
 * Preserves ANSI escape codes when joining wrapped lines
 * @param rawLines - Array of wrapped lines
 * @returns String with preserved ANSI codes
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
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

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
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

        const code = ANSI_RESET_CODES.get(Number(escapeCode));

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
 * Enum representing different wrapping strategies for text
 */
export const WrapMode = {
    /**
     * Breaks words at character boundaries to fit the width
     */
    BREAK_AT_CHARACTERS: "BREAK_AT_CHARACTERS",

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
     * @default WrapMode.PRESERVE_WORDS
     */
    wrapMode?: keyof typeof WrapMode;
}

/**
 * Word wrap implementation with multiple wrapping strategies
 * @param string - The string to wrap
 * @param options - Wrapping options
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
    let normalizedString = String(string).normalize("NFC").replaceAll("\r\n", "\n");

    if (removeZeroWidthCharacters) {
        normalizedString = normalizedString.replaceAll(ZERO_WIDTH_REGEX, "");
    }

    const result = normalizedString.split("\n").map((line) => {
        if (trim && line.trim() === "") {
            return "";
        }

        let wrappedLines: string[];

        switch (wrapMode) {
            case WrapMode.STRICT_WIDTH: {
                wrappedLines = wrapWithBreakAtWidth(line, width, trim);
                break;
            }
            case WrapMode.BREAK_AT_CHARACTERS: {
                wrappedLines = wrapCharByChar(line, width, trim);
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
