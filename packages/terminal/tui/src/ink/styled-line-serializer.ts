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

import { colorToSgrParams } from "./color-utils";
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

            // Handle link changes. Links prefixed with "ST:" use the ST
            // terminator (\x1B\\); others use BEL (\x07).
            if (link !== prevLink) {
                if (prevLink) {
                    const prevUseST = prevLink.startsWith("ST:");

                    parts.push(prevUseST ? "\u001B]8;;\u001B\\" : "\u001B]8;;\u0007");
                }

                if (link) {
                    const useST = link.startsWith("ST:");
                    const url = useST ? link.slice(3) : link;
                    const terminator = useST ? "\u001B\\" : "\u0007";

                    parts.push(`\u001B]8;;${url}${terminator}`);
                }
            }

            // Emit each style change as its own SGR sequence.
            // Bold/dim resets first (since SGR 22 affects both), then new
            // format flags, then colors. This matches chalk's common nesting
            // pattern of format(color(text)).
            {
                // Bold and dim share SGR 22 for reset — handle first
                const prevBoldDim = prevFlags & (BOLD_MASK | DIM_MASK);
                const newBoldDim = flags & (BOLD_MASK | DIM_MASK);

                if (prevBoldDim !== newBoldDim) {
                    const removingBold = (prevFlags & BOLD_MASK) && !(flags & BOLD_MASK);
                    const removingDim = (prevFlags & DIM_MASK) && !(flags & DIM_MASK);

                    if (removingBold || removingDim) {
                        parts.push(sgr([SGR_NO_BOLD])); // resets both bold and dim
                    }

                    // Re-apply what's (still) active
                    if (flags & BOLD_MASK && (!(prevFlags & BOLD_MASK) || removingDim)) {
                        parts.push(sgr([SGR_BOLD]));
                    }

                    if (flags & DIM_MASK && (!(prevFlags & DIM_MASK) || removingBold)) {
                        parts.push(sgr([SGR_DIM]));
                    }
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

                // Colors after format flags
                if (fgColor !== prevFg) {
                    if (fgColor) {
                        parts.push(sgr(colorToSgrParams(fgColor, true)));
                    } else {
                        parts.push(sgr([SGR_FG_DEFAULT]));
                    }
                }

                if (bgColor !== prevBg) {
                    if (bgColor) {
                        parts.push(sgr(colorToSgrParams(bgColor, false)));
                    } else {
                        parts.push(sgr([SGR_BG_DEFAULT]));
                    }
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

    // Close any remaining styles: innermost (format flags) first, then
    // outermost (colors) — reverse of opening order, matching chalk.
    if (hasActiveStyles) {
        if (prevFlags & (BOLD_MASK | DIM_MASK)) {
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
        const useST = prevLink.startsWith("ST:");

        parts.push(useST ? "\u001B]8;;\u001B\\" : "\u001B]8;;\u0007");
    }

    return parts.join("");
};
