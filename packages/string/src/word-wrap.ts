import { stripAnsi } from "./case/utils/regex";
import { getStringWidth } from "./get-string-width";

const ESCAPES = new Set(["\u001B", "\u009B"]);
const END_CODE = 39;
const ANSI_ESCAPE_BELL = "\u0007";
const ANSI_CSI = "[";
const ANSI_SGR_TERMINATOR = "m";
const ANSI_ESCAPE_LINK = `]8;;`;

/**
 * Wraps an ANSI code in the escape sequence
 * @param code The ANSI code to wrap
 * @returns The wrapped ANSI code
 */
const wrapAnsiCode = (code: number | string): string => `${ESCAPES.values().next().value}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;

/**
 * Wraps an ANSI hyperlink in the escape sequence
 * @param url The URL to wrap
 * @returns The wrapped ANSI hyperlink
 */
const wrapAnsiHyperlink = (url: string): string => `${ESCAPES.values().next().value}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;

/**
 * Calculate the length of words split on ' ', ignoring
 * the extra characters added by ansi escape codes
 * @param string The string to calculate the word lengths for
 * @returns An array of word lengths
 */
const wordLengths = (string: string): number[] => string.split(" ").map((character) => getStringWidth(character));

/**
 * Wrap a long word across multiple rows
 * Ansi escape codes do not count towards length
 * @param rows The array of rows to add the wrapped word to
 * @param word The word to wrap
 * @param columns The number of columns to wrap to
 */
const wrapWord = (rows: string[], word: string, columns: number): void => {
    const characters = [...word];

    let isInsideEscape = false;
    let isInsideLinkEscape = false;
    let visible = getStringWidth(stripAnsi(rows.at(-1) ?? ""));

    for (const [index, character] of characters.entries()) {
        const characterLength = getStringWidth(character);

        if (visible + characterLength <= columns) {
            rows[rows.length - 1] += character;
        } else {
            rows.push(character);
            visible = 0;
        }

        if (ESCAPES.has(character)) {
            isInsideEscape = true;

            const ansiEscapeLinkCandidate = characters.slice(index + 1, index + 1 + ANSI_ESCAPE_LINK.length).join("");
            isInsideLinkEscape = ansiEscapeLinkCandidate === ANSI_ESCAPE_LINK;
        }

        if (isInsideEscape) {
            if (isInsideLinkEscape) {
                if (character === ANSI_ESCAPE_BELL) {
                    isInsideEscape = false;
                    isInsideLinkEscape = false;
                }
            } else if (character === ANSI_SGR_TERMINATOR) {
                isInsideEscape = false;
            }

            continue;
        }

        if (characterLength > 0) {
            visible += characterLength;
        }

        if (visible === columns && index < characters.length - 1) {
            rows.push("");
            visible = 0;
        }
    }

    // It's possible that the last row we copy over is only
    // ansi escape characters, handle this edge-case
    if (!visible && rows.at(-1)?.length > 0 && rows.length > 1) {
        rows[rows.length - 2] += rows.pop();
    }
};

/**
 * Trims spaces from a string ignoring invisible sequences
 * @param string The string to trim
 * @returns The trimmed string
 */
const stringVisibleTrimSpacesRight = (string: string): string => {
    const words = string.split(" ");
    let last = words.length;

    while (last > 0) {
        if (getStringWidth(words[last - 1]) > 0) {
            break;
        }

        last--;
    }

    if (last === words.length) {
        return string;
    }

    return words.slice(0, last).join(" ") + words.slice(last).join("");
};

/**
 * The wrap-ansi module can be invoked in either 'hard' or 'soft' wrap mode.
 * 'hard' will never allow a string to take up more than columns characters.
 * 'soft' allows long words to expand past the column length.
 * @param string The string to wrap
 * @param options The options to use
 * @returns The wrapped string
 */
const exec = (string: string, options: WordWrapOptions): string => {
    if (options.trim !== false && string.trim() === "") {
        return "";
    }

    let returnValue = "";
    let escapeCode: number | string | undefined;
    let escapeUrl: string | undefined;

    const lengths = wordLengths(string);
    let rows: string[] = [""];

    for (const [index, word] of string.split(" ").entries()) {
        if (options.trim !== false) {
            rows[rows.length - 1] = rows.at(-1)?.trimStart() ?? "";
        }

        let rowLength = getStringWidth(rows.at(-1) ?? "");

        if (index !== 0) {
            if (rowLength >= options.width && (options.wordWrap === false || options.trim === false)) {
                // If we start with a new word but the current row length equals the length of the columns, add a new row
                rows.push("");
                rowLength = 0;
            }

            if (rowLength > 0 || options.trim === false) {
                rows[rows.length - 1] += " ";
                rowLength++;
            }
        }

        // In 'hard' wrap mode, the length of a line is never allowed to extend past 'columns'
        if (options.hard && lengths[index] > options.width) {
            const remainingColumns = options.width - rowLength;
            const breaksStartingThisLine = 1 + Math.floor((lengths[index] - remainingColumns - 1) / options.width);
            const breaksStartingNextLine = Math.floor((lengths[index] - 1) / options.width);
            if (breaksStartingNextLine < breaksStartingThisLine) {
                rows.push("");
            }

            wrapWord(rows, word, options.width);
            continue;
        }

        if (rowLength + lengths[index] > options.width && rowLength > 0 && lengths[index] > 0) {
            if (options.wordWrap === false && rowLength < options.width) {
                wrapWord(rows, word, options.width);
                continue;
            }

            rows.push("");
        }

        if (rowLength + lengths[index] > options.width && options.wordWrap === false) {
            wrapWord(rows, word, options.width);
            continue;
        }

        rows[rows.length - 1] += word;
    }

    if (options.trim !== false) {
        rows = rows.map((row) => stringVisibleTrimSpacesRight(row));
    }

    const preString = rows.join("\n");
    const pre = [...preString];

    // We need to keep a separate index as `String#slice()` works on Unicode code units, while `pre` is an array of codepoints.
    let preStringIndex = 0;

    for (const [index, character] of pre.entries()) {
        returnValue += character;

        if (ESCAPES.has(character)) {
            const { groups } = new RegExp(`(?:\${ANSI_CSI}(?<code>\d+)m|\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`).exec(
                preString.slice(preStringIndex),
            ) || { groups: {} };
            if (groups?.code !== undefined) {
                const code = Number.parseFloat(groups.code);
                escapeCode = code === END_CODE ? undefined : code;
            } else if (groups?.uri !== undefined) {
                escapeUrl = groups.uri.length === 0 ? undefined : groups.uri;
            }
        }

        if (pre[index + 1] === "\n") {
            if (escapeUrl) {
                returnValue += wrapAnsiHyperlink("");
            }

            if (escapeCode) {
                returnValue += wrapAnsiCode(escapeCode);
            }
        } else if (character === "\n") {
            if (escapeCode) {
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
 * Options for the wrapAnsi function
 */
export interface WordWrapOptions {
    /**
     * Hard wrap the string
     * @default false
     */
    hard?: boolean;
    /**
     * Trim the string
     * @default true
     */
    trim?: boolean;
    /**
     * The width to wrap to
     * @default 80
     */
    width?: number;
    /**
     * Word wrap the string
     * @default true
     */
    wordWrap?: boolean;
}


/**
 * Word wraps a string with ANSI escape codes
 * @param string The string to wrap
 * @param options The options to use
 * @returns The wrapped string
 */
export const wordWrap = (string: string, options: WordWrapOptions = {}): string => {
    const config = {
        hard: false,
        trim: true,
        width: 80,
        wordWrap: true,
        ...options,
    };

    return String(string)
        .normalize()
        .replaceAll("\r\n", "\n")
        .split("\n")
        .map((line) => exec(line, config))
        .join("\n");
};
