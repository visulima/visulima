/**
 * Bridge between @alcalzone/ansi-tokenize's StyledChar model and our StyledLine model.
 *
 * These functions allow incremental migration -- existing code can convert
 * between the two formats until all consumers are migrated to StyledLine.
 *
 * The bridge remains necessary because toStyledCharacters() handles complex
 * character combining (emoji ZWJ sequences, regional indicators, skin tones,
 * tabs) that has not been replicated in native StyledLine tokenization.
 */

/* eslint-disable no-bitwise */

import type { StyledChar } from "@alcalzone/ansi-tokenize";

import { ansi256ToColorName, colorToAnsiCode } from "./color-utils";
import { StyledLine } from "./styled-line";
import {
    BOLD_MASK,
    DIM_MASK,
    FULL_WIDTH_MASK,
    HIDDEN_MASK,
    INVERSE_MASK,
    ITALIC_MASK,
    STRIKETHROUGH_MASK,
    UNDERLINE_MASK,
} from "./style-flags";

// SGR parameter regex
const sgrRegex = /\u001B\[([0-9;]*)m/;

/**
 * Parse a single ANSI escape code string to extract SGR parameters.
 */
const parseSgrParams = (escapeString: string): number[] => {
    const match = sgrRegex.exec(escapeString);

    if (!match?.[1]) {
        return [];
    }

    return match[1].split(";").map(Number);
};

type ParsedStyle = {
    bgColor?: string;
    fgColor?: string;
    formatFlags: number;
    link?: string;
};

/**
 * Convert a StyledChar's AnsiCode[] styles to StyledLine-compatible format flags and colors.
 */
export const ansiCodesToStyleInfo = (styles: StyledChar["styles"]): ParsedStyle => {
    let formatFlags = 0;
    let fgColor: string | undefined;
    let bgColor: string | undefined;
    let link: string | undefined;

    for (const style of styles) {
        // Check for hyperlink OSC codes
        if (style.code.startsWith("\u001B]8;")) {
            const urlMatch = /\u001B\]8;[^;]*;(.+?)(\u001B\\|\u0007)/.exec(style.code);

            if (urlMatch?.[1]) {
                // Preserve the terminator format: prefix URL with "ST:" for ST terminator
                const usesST = urlMatch[2] === "\u001B\\";

                link = usesST ? `ST:${urlMatch[1]}` : urlMatch[1];
            }

            continue;
        }

        const params = parseSgrParams(style.code);

        if (params.length === 0) {
            continue;
        }

        let index = 0;

        while (index < params.length) {
            const code = params[index]!;

            switch (code) {
                case 0: {
                    formatFlags = 0;
                    fgColor = undefined;
                    bgColor = undefined;
                    break;
                }

                case 1: {
                    formatFlags |= BOLD_MASK;
                    break;
                }

                case 2: {
                    formatFlags |= DIM_MASK;
                    break;
                }

                case 3: {
                    formatFlags |= ITALIC_MASK;
                    break;
                }

                case 4: {
                    formatFlags |= UNDERLINE_MASK;
                    break;
                }

                case 7: {
                    formatFlags |= INVERSE_MASK;
                    break;
                }

                case 8: {
                    formatFlags |= HIDDEN_MASK;
                    break;
                }

                case 9: {
                    formatFlags |= STRIKETHROUGH_MASK;
                    break;
                }

                case 30:
                case 31:
                case 32:
                case 33:
                case 34:
                case 35:
                case 36:
                case 37: {
                    fgColor = ansi256ToColorName(code - 30);
                    break;
                }

                case 38: {
                    if (params[index + 1] === 5 && params[index + 2] !== undefined) {
                        fgColor = ansi256ToColorName(params[index + 2]!);
                        index += 2;
                    } else if (params[index + 1] === 2 && index + 4 < params.length) {
                        fgColor = `rgb(${params[index + 2]}, ${params[index + 3]}, ${params[index + 4]})`;
                        index += 4;
                    }

                    break;
                }

                case 39: {
                    fgColor = undefined;
                    break;
                }

                case 40:
                case 41:
                case 42:
                case 43:
                case 44:
                case 45:
                case 46:
                case 47: {
                    bgColor = ansi256ToColorName(code - 40);
                    break;
                }

                case 48: {
                    if (params[index + 1] === 5 && params[index + 2] !== undefined) {
                        bgColor = ansi256ToColorName(params[index + 2]!);
                        index += 2;
                    } else if (params[index + 1] === 2 && index + 4 < params.length) {
                        bgColor = `rgb(${params[index + 2]}, ${params[index + 3]}, ${params[index + 4]})`;
                        index += 4;
                    }

                    break;
                }

                case 49: {
                    bgColor = undefined;
                    break;
                }

                case 90:
                case 91:
                case 92:
                case 93:
                case 94:
                case 95:
                case 96:
                case 97: {
                    // Bright fg: use ansi256 format to preserve exact escape code
                    fgColor = `ansi256(${code - 90 + 8})`;
                    break;
                }

                case 100:
                case 101:
                case 102:
                case 103:
                case 104:
                case 105:
                case 106:
                case 107: {
                    // Bright bg: use ansi256 format to preserve exact escape code
                    bgColor = `ansi256(${code - 100 + 8})`;
                    break;
                }

                default: {
                    break;
                }
            }

            index++;
        }
    }

    return { bgColor, fgColor, formatFlags, link };
};

/**
 * Convert a StyledChar array to a StyledLine.
 */
export const styledCharsToStyledLine = (chars: StyledChar[]): StyledLine => {
    if (chars.length === 0) {
        return new StyledLine();
    }

    const line = new StyledLine();

    for (const char of chars) {
        const { bgColor, fgColor, formatFlags, link } = ansiCodesToStyleInfo(char.styles);
        const flags = char.fullWidth ? formatFlags | FULL_WIDTH_MASK : formatFlags;

        line.pushChar(char.value, flags, fgColor, bgColor, link);
    }

    return line;
};

/**
 * Convert a StyledLine back to a StyledChar array.
 *
 * This is for backward compatibility during migration. The produced
 * StyledChar objects use reconstructed AnsiCode arrays.
 */
export const styledLineToStyledChars = (line: StyledLine): StyledChar[] => {
    const chars: StyledChar[] = [];

    for (const entry of line) {
        const styles: StyledChar["styles"] = [];
        const flags = entry.formatFlags & ~FULL_WIDTH_MASK;

        if (flags & BOLD_MASK) {
            styles.push({ code: "\u001B[1m", endCode: "\u001B[22m", type: "ansi" });
        }

        if (flags & DIM_MASK) {
            styles.push({ code: "\u001B[2m", endCode: "\u001B[22m", type: "ansi" });
        }

        if (flags & ITALIC_MASK) {
            styles.push({ code: "\u001B[3m", endCode: "\u001B[23m", type: "ansi" });
        }

        if (flags & UNDERLINE_MASK) {
            styles.push({ code: "\u001B[4m", endCode: "\u001B[24m", type: "ansi" });
        }

        if (flags & INVERSE_MASK) {
            styles.push({ code: "\u001B[7m", endCode: "\u001B[27m", type: "ansi" });
        }

        if (flags & HIDDEN_MASK) {
            styles.push({ code: "\u001B[8m", endCode: "\u001B[28m", type: "ansi" });
        }

        if (flags & STRIKETHROUGH_MASK) {
            styles.push({ code: "\u001B[9m", endCode: "\u001B[29m", type: "ansi" });
        }

        if (entry.fgColor) {
            const fgCode = colorToAnsiCode(entry.fgColor, true);

            if (fgCode) {
                styles.push({ code: fgCode, endCode: "\u001B[39m", type: "ansi" });
            }
        }

        if (entry.bgColor) {
            const bgCode = colorToAnsiCode(entry.bgColor, false);

            if (bgCode) {
                styles.push({ code: bgCode, endCode: "\u001B[49m", type: "ansi" });
            }
        }

        chars.push({
            fullWidth: entry.fullWidth,
            styles,
            type: "char",
            value: entry.value,
        });
    }

    return chars;
};
