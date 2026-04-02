/**
 * Serializes a StyledLine to an ANSI-escaped terminal string.
 *
 * Emits only diff-based escape codes — a style code is written only when
 * the formatting changes between adjacent characters. Resets all active
 * styles at the end of the string.
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 *
 * @license Apache-2.0
 */

/* eslint-disable no-bitwise */

import type { StyledLine } from "./styled-line";
import { BOLD_MASK, DIM_MASK, HIDDEN_MASK, INVERSE_MASK, ITALIC_MASK, STRIKETHROUGH_MASK, UNDERLINE_MASK } from "./style-flags";

// SGR parameter codes
const SGR_RESET = 0;
const SGR_BOLD = 1;
const SGR_DIM = 2;
const SGR_ITALIC = 3;
const SGR_UNDERLINE = 4;
const SGR_INVERSE = 7;
const SGR_HIDDEN = 8;
const SGR_STRIKETHROUGH = 9;
const SGR_NO_BOLD = 22; // also resets dim
const SGR_NO_ITALIC = 23;
const SGR_NO_UNDERLINE = 24;
const SGR_NO_INVERSE = 27;
const SGR_NO_HIDDEN = 28;
const SGR_NO_STRIKETHROUGH = 29;
const SGR_FG_DEFAULT = 39;
const SGR_BG_DEFAULT = 49;

const ESC = "\u001B[";

/**
 * Emit the SGR escape sequence for a set of parameters.
 */
const sgr = (params: number[]): string => {
    if (params.length === 0) {
        return "";
    }

    return `${ESC}${params.join(";")}m`;
};

/**
 * Parse a named/hex/rgb/ansi256 color string into SGR parameters.
 * Returns the parameter array for the SGR sequence (e.g., [38, 5, 196] for fg ansi256).
 */
const colorToSgr = (color: string, isFg: boolean): number[] => {
    const base = isFg ? 30 : 40;

    // Named 16-color
    const namedColors: Record<string, number> = {
        black: 0,
        blue: 4,
        cyan: 6,
        gray: 60,
        green: 2,
        grey: 60,
        magenta: 5,
        red: 1,
        white: 7,
        yellow: 3,
    };

    // Bright variants
    const brightColors: Record<string, number> = {
        blackBright: 60,
        blueBright: 64,
        cyanBright: 66,
        greenBright: 62,
        magentaBright: 65,
        redBright: 61,
        whiteBright: 67,
        yellowBright: 63,
    };

    const named = namedColors[color];

    if (named !== undefined) {
        return [base + named];
    }

    const bright = brightColors[color];

    if (bright !== undefined) {
        return [base + bright];
    }

    // Hex color: #RRGGBB
    if (color.startsWith("#") && color.length === 7) {
        const r = Number.parseInt(color.slice(1, 3), 16);
        const g = Number.parseInt(color.slice(3, 5), 16);
        const b = Number.parseInt(color.slice(5, 7), 16);

        return [isFg ? 38 : 48, 2, r, g, b];
    }

    // ansi256(N)
    const ansi256Match = /^ansi256\(\s?(\d+)\s?\)$/.exec(color);

    if (ansi256Match) {
        return [isFg ? 38 : 48, 5, Number(ansi256Match[1])];
    }

    // rgb(R, G, B)
    const rgbMatch = /^rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)$/.exec(color);

    if (rgbMatch) {
        return [isFg ? 38 : 48, 2, Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
    }

    return [];
};

/**
 * Convert a StyledLine to an ANSI-escaped string.
 *
 * Only emits escape codes when the style changes between characters.
 * This produces minimal ANSI output.
 */
export const styledLineToString = (line: StyledLine): string => {
    if (line.length === 0) {
        return "";
    }

    const parts: string[] = [];
    let prevFlags = 0;
    let prevFg: string | undefined;
    let prevBg: string | undefined;
    let prevLink: string | undefined;
    let hasActiveStyles = false;

    for (const char of line) {
        const { bgColor, fgColor, formatFlags, link, value } = char;
        const flags = formatFlags & 0x7f; // strip FULL_WIDTH_MASK

        // Compute style diff
        if (flags !== prevFlags || fgColor !== prevFg || bgColor !== prevBg || link !== prevLink) {
            const params: number[] = [];

            // Handle link changes
            if (link !== prevLink) {
                if (prevLink) {
                    parts.push("\u001B]8;;\u0007"); // close link
                }

                if (link) {
                    parts.push(`\u001B]8;;${link}\u0007`); // open link
                }
            }

            // Emit each style change as its own SGR sequence to match
            // chalk's per-attribute escape code output.
            {
                if (fgColor !== prevFg) {
                    if (fgColor) {
                        parts.push(sgr(colorToSgr(fgColor, true)));
                    } else {
                        parts.push(sgr([SGR_FG_DEFAULT]));
                    }
                }

                if (bgColor !== prevBg) {
                    if (bgColor) {
                        parts.push(sgr(colorToSgr(bgColor, false)));
                    } else {
                        parts.push(sgr([SGR_BG_DEFAULT]));
                    }
                }

                if ((flags & BOLD_MASK) && !(prevFlags & BOLD_MASK)) {
                    parts.push(sgr([SGR_BOLD]));
                } else if (!(flags & BOLD_MASK) && (prevFlags & BOLD_MASK)) {
                    parts.push(sgr([SGR_NO_BOLD]));
                }

                if ((flags & DIM_MASK) && !(prevFlags & DIM_MASK)) {
                    parts.push(sgr([SGR_DIM]));
                } else if (!(flags & DIM_MASK) && (prevFlags & DIM_MASK)) {
                    parts.push(sgr([SGR_NO_BOLD])); // SGR 22 resets both bold and dim
                }

                if ((flags & ITALIC_MASK) && !(prevFlags & ITALIC_MASK)) {
                    parts.push(sgr([SGR_ITALIC]));
                } else if (!(flags & ITALIC_MASK) && (prevFlags & ITALIC_MASK)) {
                    parts.push(sgr([SGR_NO_ITALIC]));
                }

                if ((flags & UNDERLINE_MASK) && !(prevFlags & UNDERLINE_MASK)) {
                    parts.push(sgr([SGR_UNDERLINE]));
                } else if (!(flags & UNDERLINE_MASK) && (prevFlags & UNDERLINE_MASK)) {
                    parts.push(sgr([SGR_NO_UNDERLINE]));
                }

                if ((flags & INVERSE_MASK) && !(prevFlags & INVERSE_MASK)) {
                    parts.push(sgr([SGR_INVERSE]));
                } else if (!(flags & INVERSE_MASK) && (prevFlags & INVERSE_MASK)) {
                    parts.push(sgr([SGR_NO_INVERSE]));
                }

                if ((flags & HIDDEN_MASK) && !(prevFlags & HIDDEN_MASK)) {
                    parts.push(sgr([SGR_HIDDEN]));
                } else if (!(flags & HIDDEN_MASK) && (prevFlags & HIDDEN_MASK)) {
                    parts.push(sgr([SGR_NO_HIDDEN]));
                }

                if ((flags & STRIKETHROUGH_MASK) && !(prevFlags & STRIKETHROUGH_MASK)) {
                    parts.push(sgr([SGR_STRIKETHROUGH]));
                } else if (!(flags & STRIKETHROUGH_MASK) && (prevFlags & STRIKETHROUGH_MASK)) {
                    parts.push(sgr([SGR_NO_STRIKETHROUGH]));
                }
            }

            hasActiveStyles = flags !== 0 || fgColor !== undefined || bgColor !== undefined;

            prevFlags = flags;
            prevFg = fgColor;
            prevBg = bgColor;
            prevLink = link;
        }

        parts.push(value);
    }

    // Close any remaining styles with individual targeted resets
    if (hasActiveStyles) {
        if (prevFlags & BOLD_MASK || prevFlags & DIM_MASK) {
            parts.push(sgr([SGR_NO_BOLD]));
        }

        if (prevFlags & ITALIC_MASK) {
            parts.push(sgr([SGR_NO_ITALIC]));
        }

        if (prevFlags & UNDERLINE_MASK) {
            parts.push(sgr([SGR_NO_UNDERLINE]));
        }

        if (prevFlags & INVERSE_MASK) {
            parts.push(sgr([SGR_NO_INVERSE]));
        }

        if (prevFlags & HIDDEN_MASK) {
            parts.push(sgr([SGR_NO_HIDDEN]));
        }

        if (prevFlags & STRIKETHROUGH_MASK) {
            parts.push(sgr([SGR_NO_STRIKETHROUGH]));
        }

        if (prevFg !== undefined) {
            parts.push(sgr([SGR_FG_DEFAULT]));
        }

        if (prevBg !== undefined) {
            parts.push(sgr([SGR_BG_DEFAULT]));
        }
    }

    // Close any remaining link
    if (prevLink) {
        parts.push("\u001B]8;;\u0007");
    }

    return parts.join("");
};
