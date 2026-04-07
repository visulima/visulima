/**
 * Direct text → StyledLine pipeline.
 *
 * Converts ANSI-styled text to StyledLine without the intermediate StyledChar
 * representation, eliminating the `@alcalzone/ansi-tokenize` dependency.
 *
 * The pipeline:
 * 1. tokenizeAnsi() — splits text into ANSI tokens and plain text
 * 2. SGR state machine — tracks active formatting from CSI SGR sequences
 * 3. Grapheme segmenter — handles combining chars, emoji, regional indicators
 * 4. StyledLine.pushChar() — appends each grapheme with its resolved style
 */

/* eslint-disable no-bitwise */

import { isFullwidthCodePoint } from "@visulima/string";

import type { AnsiToken } from "./ansi-tokenizer";
import { tokenizeAnsi } from "./ansi-tokenizer";
import { ansi256ToColorName } from "./color-utils";
import { BOLD_MASK, DIM_MASK, FULL_WIDTH_MASK, HIDDEN_MASK, INVERSE_MASK, ITALIC_MASK, STRIKETHROUGH_MASK, UNDERLINE_MASK } from "./style-flags";
import { StyledLine } from "./styled-line";

// ── SGR State Machine ────────────────────────────────────────────────

type SgrState = {
    bgColor: string | undefined;
    fgColor: string | undefined;
    formatFlags: number;
    link: string | undefined;
};

const createSgrState = (): SgrState => {
    return {
        bgColor: undefined,
        fgColor: undefined,
        formatFlags: 0,
        link: undefined,
    };
};

/**
 * Parse a CSI SGR parameter string (e.g. "1;31;48;5;12") and apply it
 * to the current SGR state, returning the updated state.
 */
const applySgrParams = (state: SgrState, parameterString: string): SgrState => {
    if (parameterString.length === 0) {
        // ESC[m is equivalent to ESC[0m (reset)
        return createSgrState();
    }

    // Handle colon-delimited sub-parameters (e.g., "38:2::255:100:0")
    // by normalizing to semicolon delimiter
    const normalizedParams = parameterString.includes(":") ? parameterString.replaceAll(":", ";") : parameterString;
    const params = normalizedParams
        .split(";")
        .filter((s) => s.length > 0)
        .map(Number);
    let { bgColor, fgColor, formatFlags, link } = state;

    let index = 0;

    while (index < params.length) {
        const code = params[index]!;

        switch (code) {
            case 0: {
                formatFlags = 0;
                fgColor = undefined;
                bgColor = undefined;
                link = undefined;
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

            // Reset individual attributes
            case 22: {
                formatFlags &= ~(BOLD_MASK | DIM_MASK);
                break;
            }

            case 23: {
                formatFlags &= ~ITALIC_MASK;
                break;
            }

            case 24: {
                formatFlags &= ~UNDERLINE_MASK;
                break;
            }

            case 27: {
                formatFlags &= ~INVERSE_MASK;
                break;
            }

            case 28: {
                formatFlags &= ~HIDDEN_MASK;
                break;
            }

            case 29: {
                formatFlags &= ~STRIKETHROUGH_MASK;
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
                fgColor = ansi256ToColorName(code - 30);
                break;
            }

            // Extended foreground: 256-color or RGB
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

            // Default foreground
            case 39: {
                fgColor = undefined;
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
                bgColor = ansi256ToColorName(code - 40);
                break;
            }

            // Extended background: 256-color or RGB
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

            // Default background
            case 49: {
                bgColor = undefined;
                break;
            }

            // Bright foreground (90-97)
            case 90:
            case 91:
            case 92:
            case 93:
            case 94:
            case 95:
            case 96:
            case 97: {
                fgColor = `ansi256(${code - 90 + 8})`;
                break;
            }

            // Bright background (100-107)
            case 100:
            case 101:
            case 102:
            case 103:
            case 104:
            case 105:
            case 106:
            case 107: {
                bgColor = `ansi256(${code - 100 + 8})`;
                break;
            }

            default: {
                break;
            }
        }

        index++;
    }

    return { bgColor, fgColor, formatFlags, link };
};

// ── Grapheme Helpers ─────────────────────────────────────────────────

const REGIONAL_INDICATOR_START = 0x1_f1_e6;
const REGIONAL_INDICATOR_END = 0x1_f1_ff;
const SKIN_TONE_START = 0x1_f3_fb;
const SKIN_TONE_END = 0x1_f3_ff;
const ZWJ = 0x20_0d;
const TAGS_BLOCK_START = 0xe_00_00;
const TAGS_BLOCK_END = 0xe_00_7f;

const unicodeMarkRegex = /\p{Mark}/u;

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const isFullwidthGrapheme = (grapheme: string, codePoint: number): boolean => {
    if (isFullwidthCodePoint(codePoint)) {
        return true;
    }

    // Emoji variation selector (text → emoji presentation)
    if (grapheme.includes("\uFE0F")) {
        return true;
    }

    // Regional indicators (flag pairs)
    if (codePoint >= REGIONAL_INDICATOR_START && codePoint <= REGIONAL_INDICATOR_END) {
        return true;
    }

    return false;
};

// ── OSC Hyperlink Parsing ────────────────────────────────────────────

// Matches both ESC-based (\x1B]8;...) and C1-based (\x9D8;...) OSC hyperlinks
// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex, regexp/no-unused-capturing-group -- ANSI escape sequences require control characters; capturing group aids debugging
const oscHyperlinkRegex = /(?:\u001B\]|\u009D)8;([^;]*);(.*?)(?:\u001B\\|\u0007|\u009C)/;

const parseOscHyperlink = (oscValue: string): string | undefined => {
    const match = oscHyperlinkRegex.exec(oscValue);

    if (!match?.[2]) {
        return undefined;
    }

    // Empty URL means "close link"
    if (match[2].length === 0) {
        return undefined;
    }

    // Preserve the terminator format
    const usesST = oscValue.endsWith("\u001B\\");

    return usesST ? `ST:${match[2]}` : match[2];
};

// ── Core Pipeline ────────────────────────────────────────────────────

/**
 * Process text tokens: segment into graphemes, handle combining sequences,
 * and push each character to the StyledLine with current SGR state.
 */
const processTextToken = (text: string, line: StyledLine, state: SgrState): void => {
    const segments = graphemeSegmenter.segment(text);
    // Collect all graphemes for lookahead (combining logic)
    const graphemes: string[] = [];

    for (const { segment } of segments) {
        graphemes.push(segment);
    }

    for (let i = 0; i < graphemes.length; i++) {
        let value = graphemes[i]!;

        // Convert tabs to 4 spaces
        if (value === "\t") {
            for (let s = 0; s < 4; s++) {
                line.pushChar(" ", state.formatFlags, state.fgColor, state.bgColor, state.link);
            }

            continue;
        }

        // Skip backspace characters
        if (value === "\b") {
            continue;
        }

        const firstCodePoint = value.codePointAt(0);

        if (!firstCodePoint) {
            continue;
        }

        // Regional Indicators (Flag emoji) — combine in pairs
        if (firstCodePoint >= REGIONAL_INDICATOR_START && firstCodePoint <= REGIONAL_INDICATOR_END && i + 1 < graphemes.length) {
            const nextGrapheme = graphemes[i + 1]!;
            const nextCodePoint = nextGrapheme.codePointAt(0);

            if (nextCodePoint && nextCodePoint >= REGIONAL_INDICATOR_START && nextCodePoint <= REGIONAL_INDICATOR_END) {
                value += nextGrapheme;
                i++;
            }
        } else {
            // Combining characters: standalone Unicode marks, skin tone modifiers,
            // ZWJ sequences, tags block.
            // Since Intl.Segmenter already clusters most combining sequences,
            // we only merge graphemes whose FIRST code point is itself a
            // combining character (e.g., a bare diacritic or ZWJ).
            while (i + 1 < graphemes.length) {
                const nextGrapheme = graphemes[i + 1]!;
                const nextCodePoint = nextGrapheme.codePointAt(0);

                if (!nextCodePoint) {
                    break;
                }

                // Check if the first code point of the next grapheme is a combining character
                const firstCharIsUnicodeMark = unicodeMarkRegex.test(String.fromCodePoint(nextCodePoint));
                const isSkinToneModifier = nextCodePoint >= SKIN_TONE_START && nextCodePoint <= SKIN_TONE_END;
                const isZeroWidthJoiner = nextCodePoint === ZWJ;
                const isTagsBlock = nextCodePoint >= TAGS_BLOCK_START && nextCodePoint <= TAGS_BLOCK_END;

                if (!firstCharIsUnicodeMark && !isSkinToneModifier && !isZeroWidthJoiner && !isTagsBlock) {
                    break;
                }

                value += nextGrapheme;
                i++;

                // If it was a ZWJ, also consume the character after it
                if (isZeroWidthJoiner && i + 1 < graphemes.length) {
                    value += graphemes[i + 1]!;
                    i++;
                }
            }
        }

        const fw = isFullwidthGrapheme(value, firstCodePoint);
        const flags = fw ? state.formatFlags | FULL_WIDTH_MASK : state.formatFlags;

        line.pushChar(value, flags, state.fgColor, state.bgColor, state.link);
    }
};

/**
 * Convert an ANSI-styled text string directly to a StyledLine.
 *
 * This is the zero-dependency replacement for the chain:
 * tokenize() → styledCharsFromTokens() → styledCharsToStyledLine().
 */
export const textToStyledLine = (text: string): StyledLine => {
    if (text.length === 0) {
        return new StyledLine();
    }

    const tokens: AnsiToken[] = tokenizeAnsi(text);
    const line = new StyledLine();
    let sgrState = createSgrState();

    for (const token of tokens) {
        switch (token.type) {
            case "csi": {
                // Only SGR sequences (final char 'm') affect styling
                if (token.finalCharacter === "m") {
                    sgrState = applySgrParams(sgrState, token.parameterString);
                }

                // Other CSI sequences (cursor movement, etc.) are ignored
                break;
            }

            case "osc": {
                // Check for hyperlink OSC 8
                const link = parseOscHyperlink(token.value);

                if (link !== undefined) {
                    sgrState = { ...sgrState, link };
                } else if (token.value.includes("8;")) {
                    // Close-link OSC (empty URL) — covers both ESC and C1 forms
                    sgrState = { ...sgrState, link: undefined };
                }

                break;
            }

            case "text": {
                processTextToken(token.value, line, sgrState);
                break;
            }

            // Ignore other token types (esc, c1, st, dcs, pm, apc, sos, invalid)
            default: {
                break;
            }
        }
    }

    return line;
};

// ── Plain Text Fast Path ─────────────────────────────────────────────

const asciiPrintableRegex = /^[\u0020-\u007E]*$/;

/**
 * Build a StyledLine from plain text (no ANSI codes).
 * Uses a fast ASCII path when possible.
 */
export const plainTextToStyledLine = (text: string): StyledLine => {
    if (text.length === 0) {
        return new StyledLine();
    }

    const line = new StyledLine();

    // Fast path: pure ASCII printable
    if (asciiPrintableRegex.test(text)) {
        for (const element of text) {
            line.pushChar(element, 0);
        }

        return line;
    }

    // Slow path: handle grapheme clusters, full-width, etc.
    processTextToken(text, line, createSgrState());

    return line;
};
