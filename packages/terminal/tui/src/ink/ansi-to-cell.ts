/* eslint-disable @typescript-eslint/no-non-null-assertion, jsdoc/lines-before-block, jsdoc/match-description, no-bitwise, no-control-regex, no-fallthrough, no-for-of-array/no-for-of-array, no-plusplus, sonarjs/cognitive-complexity */
/**
 * Converts Ink's AnsiCode-based styling to the packed Cell format used by the
 * Rust renderer's Uint32Array back-buffer.
 *
 * AnsiCode objects carry raw ANSI escape strings (e.g., "\x1b[1m" for bold).
 * This module parses those strings to extract SGR parameters and maps them
 * to the packed (styles &lt;< 16 | bg &lt;< 8 | fg) format.
 */
import type { StyledChar } from "@alcalzone/ansi-tokenize";

import { StyleMasks } from "../core/cell";

// Parse SGR parameters from an ANSI escape string.
// e.g., "\x1b[38;5;196m" → [38, 5, 196]
// e.g., "\x1b[1m" → [1]
const sgrRegex = /\u001B\[([0-9;]*)m/;

const parseSgrParams = (escapeString: string): number[] => {
    const match = sgrRegex.exec(escapeString);

    if (!match?.[1]) {
        return [];
    }

    return match[1].split(";").map(Number);
};

// Map an RGB triple to the nearest ANSI 256-color index.
// Colors 16-231 form a 6x6x6 RGB cube.
const rgbToAnsi256 = (r: number, g: number, b: number): number => {
    const ri = Math.round(r / 51);
    const gi = Math.round(g / 51);
    const bi = Math.round(b / 51);

    return 16 + 36 * ri + 6 * gi + bi;
};

type CellAttributes = {
    bg: number;
    fg: number;
    styles: number;
};

/**
 * Convert a StyledChar's AnsiCode[] styles to packed Cell attributes.
 * Returns { styles: bitmask, fg: 0-255, bg: 0-255 }.
 */
export const styledCharToAttributes = (styles: StyledChar["styles"]): CellAttributes => {
    let styleMask = 0;
    let fg = 255; // default
    let bg = 255; // default

    for (const style of styles) {
        const params = parseSgrParams(style.code);

        if (params.length === 0) {
            continue;
        }

        let index = 0;

        while (index < params.length) {
            const code = params[index]!;

            // SGR style codes
            switch (code) {
                case 0: {
                    styleMask = 0;
                    fg = 255;
                    bg = 255;
                    break;
                }

                case 1: {
                    styleMask |= StyleMasks.BOLD;
                    break;
                }

                case 2: {
                    styleMask |= StyleMasks.DIM;
                    break;
                }

                case 3: {
                    styleMask |= StyleMasks.ITALIC;
                    break;
                }

                case 4: {
                    styleMask |= StyleMasks.UNDERLINE;
                    break;
                }

                case 5: {
                    styleMask |= StyleMasks.BLINK;
                    break;
                }

                case 7: {
                    styleMask |= StyleMasks.INVERT;
                    break;
                }

                case 8: {
                    styleMask |= StyleMasks.HIDDEN;
                    break;
                }

                case 9: {
                    styleMask |= StyleMasks.STRIKETHROUGH;
                    break;
                }

                // Standard foreground colors (30-37)
                case 30:
                case 31:
                case 32:
                case 33:
                case 34:
                case 35:
                case 36:
                case 37: {
                    fg = code - 30;
                    break;
                }

                // Extended foreground: 38;5;N (256-color) or 38;2;R;G;B (RGB)
                case 38: {
                    if (params[index + 1] === 5 && params[index + 2] !== undefined) {
                        fg = params[index + 2]! & 0xff;
                        index += 2;
                    } else if (params[index + 1] === 2 && index + 4 < params.length) {
                        fg = rgbToAnsi256(params[index + 2]!, params[index + 3]!, params[index + 4]!);
                        index += 4;
                    }

                    break;
                }

                // Default foreground
                case 39: {
                    fg = 255;
                    break;
                }
                // Standard background colors (40-47)
                case 40:
                case 41:
                case 42:
                case 43:
                case 44:
                case 45:
                case 46:

                case 47: {
                    bg = code - 40;
                    break;
                }

                // Extended background: 48;5;N or 48;2;R;G;B
                case 48: {
                    if (params[index + 1] === 5 && params[index + 2] !== undefined) {
                        bg = params[index + 2]! & 0xff;
                        index += 2;
                    } else if (params[index + 1] === 2 && index + 4 < params.length) {
                        bg = rgbToAnsi256(params[index + 2]!, params[index + 3]!, params[index + 4]!);
                        index += 4;
                    }

                    break;
                }
                // Default background
                case 49: {
                    bg = 255;
                    break;
                }
                // Bright foreground colors (90-97)
                case 90:
                case 91:
                case 92:
                case 93:
                case 94:
                case 95:

                case 96:
                case 97: {
                    fg = code - 90 + 8;
                    break;
                }
                // Bright background colors (100-107)
                case 100:
                case 101:
                case 102:
                case 103:
                case 104:
                case 105:

                case 106:

                case 107: {
                    bg = code - 100 + 8;
                    break;
                }

                default: {
                    break;
                }
            }

            index++;
        }
    }

    return { bg, fg, styles: styleMask & 0xff };
};

/**
 * Pack a StyledChar into the Uint32Array cell format:
 * [charCode, (styles &lt;< 16) | (bg &lt;< 8) | fg]
 */
export const packStyledChar = (cell: StyledChar): [number, number] => {
    const charCode = cell.value.codePointAt(0) ?? 32;
    const { bg, fg, styles } = styledCharToAttributes(cell.styles);
    const attributeCode = ((styles & 0xff) << 16) | ((bg & 0xff) << 8) | (fg & 0xff);

    return [charCode, attributeCode];
};

/**
 * Sentinel value for the trailing cell of a wide (fullWidth) character.
 * Must be outside Unicode scalar range so it never collides with real text.
 */
export const CONTINUATION_CELL_CODE = 0x11_00_00;
