import colorize from "../colorize";

export type CanvasColor = number | string | undefined;

export type CellStyle = {
    readonly background?: CanvasColor;
    readonly bold?: boolean;
    readonly color?: CanvasColor;
    readonly dim?: boolean;
};

const STYLE_BOLD = Math.trunc(1);
const STYLE_DIM = 1 << 1;

const STYLE_ITALIC = 1 << 2;

const SPACE_CODEPOINT = 0x20;
const EMPTY_COLOR = 0;

/**
 * Encodes a color into the buffer. `undefined` and `null` become EMPTY_COLOR (0),
 * other values are stored in a per-canvas interning map. Numbers and strings
 * with the same textual form (`1.5` vs `"1.5"`) are kept distinct via a
 * type-prefix in the cache key.
 */
type ColorEncoder = (color: CanvasColor) => number;

/**
 * Reverse of the encoder. 0 → undefined; any other id returns the original
 * CanvasColor (preserving number vs string distinction).
 */
type ColorDecoder = (id: number) => CanvasColor;

const createColorCoders = (): { decode: ColorDecoder; encode: ColorEncoder } => {
    const encoded = new Map<string, number>();
    const decoded: CanvasColor[] = [undefined];

    return {
        decode: (id) => decoded[id],
        encode: (color) => {
            if (color === undefined || color === null) {
                return EMPTY_COLOR;
            }

            const key = typeof color === "number" ? `n:${color}` : `s:${color}`;
            const existing = encoded.get(key);

            if (existing !== undefined) {
                return existing;
            }

            const next = decoded.length;

            decoded.push(color);
            encoded.set(key, next);

            return next;
        },
    };
};

export type CanvasContext = {
    /**
     * Clear every cell back to space + default style.
     */
    readonly clear: () => void;

    /**
     * Draw a horizontal bar using fractional block glyphs (▏▎▍▌▋▊▉█).
     * `fillRatio` in [0, 1] determines the filled portion.
     */
    readonly drawHBar: (x: number, y: number, w: number, fillRatio: number, style?: CellStyle) => void;

    /**
     * Draw a filled rectangle using a single character.
     */
    readonly drawRect: (x: number, y: number, w: number, h: number, char: number | string, style?: CellStyle) => void;

    /**
     * Render a string left-to-right starting at (x, y). Non-printable or
     * multi-byte codepoints are preserved but advance the cursor by 1 cell.
     */
    readonly drawText: (x: number, y: number, text: string, style?: CellStyle) => void;

    /**
     * Draw a vertical bar using fractional block glyphs (▁▂▃▄▅▆▇█).
     * `fillRatio` in [0, 1] determines the filled portion.
     */
    readonly drawVBar: (x: number, y: number, h: number, fillRatio: number, style?: CellStyle) => void;

    readonly height: number;

    /**
     * Set a single cell at (x, y). Out-of-bounds writes are silently ignored.
     */
    readonly setCell: (x: number, y: number, char: number | string, style?: CellStyle) => void;

    readonly width: number;
};

export type CanvasBuffer = {
    readonly bg: Int32Array;
    readonly chars: Uint32Array;
    readonly colorDecoder: ColorDecoder;
    readonly context: CanvasContext;
    readonly dirty: Uint8Array;
    readonly fg: Int32Array;
    readonly height: number;
    readonly styles: Uint32Array;
    readonly width: number;
};

const V_BAR_GLYPHS = [0x25_81, 0x25_82, 0x25_83, 0x25_84, 0x25_85, 0x25_86, 0x25_87, 0x25_88] as const; // ▁▂▃▄▅▆▇█
const H_BAR_GLYPHS = [0x25_8f, 0x25_8e, 0x25_8d, 0x25_8c, 0x25_8b, 0x25_8a, 0x25_89, 0x25_88] as const; // ▏▎▍▌▋▊▉█
const FULL_BLOCK = 0x25_88;

const flagsFromStyle = (style: CellStyle | undefined): number => {
    if (!style) {
        return 0;
    }

    let flags = 0;

    if (style.bold) {
        flags |= STYLE_BOLD;
    }

    if (style.dim) {
        flags |= STYLE_DIM;
    }

    return flags;
};

const toCodepoint = (char: number | string): number => {
    if (typeof char === "number") {
        return char;
    }

    return char.codePointAt(0) ?? SPACE_CODEPOINT;
};

/**
 * Allocate a canvas buffer and return a context that mutates it in place.
 * The buffer is typed-array backed; all mutations O(1) per cell with no
 * object allocation.
 */
export const createCanvasBuffer = (width: number, height: number): CanvasBuffer => {
    const cells = Math.max(0, width * height);
    const chars = new Uint32Array(cells);
    const styles = new Uint32Array(cells);
    const fg = new Int32Array(cells);
    const bg = new Int32Array(cells);
    const dirty = new Uint8Array(height);
    const { decode, encode } = createColorCoders();

    // Initial clear to spaces.
    chars.fill(SPACE_CODEPOINT);

    const markDirty = (y: number): void => {
        if (y >= 0 && y < height) {
            dirty[y] = 1;
        }
    };

    const setCellImpl = (x: number, y: number, char: number | string, style: CellStyle | undefined): void => {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return;
        }

        const index = y * width + x;
        const codepoint = toCodepoint(char);
        const fgId = encode(style?.color);
        const bgId = encode(style?.background);
        const flags = flagsFromStyle(style);

        if (chars[index] === codepoint && styles[index] === flags && fg[index] === fgId && bg[index] === bgId) {
            return;
        }

        chars[index] = codepoint;
        styles[index] = flags;
        fg[index] = fgId;
        bg[index] = bgId;
        dirty[y] = 1;
    };

    const context: CanvasContext = {
        clear: () => {
            chars.fill(SPACE_CODEPOINT);
            styles.fill(0);
            fg.fill(0);
            bg.fill(0);
            dirty.fill(1);
        },

        drawHBar: (x, y, w, fillRatio, style) => {
            if (w <= 0 || y < 0 || y >= height) {
                return;
            }

            const ratio = Math.max(0, Math.min(1, fillRatio));
            const total = w * H_BAR_GLYPHS.length;
            const filled = Math.round(ratio * total);
            const fullChars = Math.floor(filled / H_BAR_GLYPHS.length);
            const remainder = filled % H_BAR_GLYPHS.length;

            for (let column = 0; column < w; column += 1) {
                const px = x + column;

                if (column < fullChars) {
                    setCellImpl(px, y, FULL_BLOCK, style);
                } else if (column === fullChars && remainder > 0) {
                    setCellImpl(px, y, H_BAR_GLYPHS[remainder - 1]!, style);
                } else {
                    setCellImpl(px, y, SPACE_CODEPOINT, style);
                }
            }

            markDirty(y);
        },

        drawRect: (x, y, w, h, char, style) => {
            if (w <= 0 || h <= 0) {
                return;
            }

            const codepoint = toCodepoint(char);

            for (let dy = 0; dy < h; dy += 1) {
                for (let dx = 0; dx < w; dx += 1) {
                    setCellImpl(x + dx, y + dy, codepoint, style);
                }

                markDirty(y + dy);
            }
        },

        drawText: (x, y, text, style) => {
            if (y < 0 || y >= height || text.length === 0) {
                return;
            }

            let column = 0;

            for (const char of text) {
                setCellImpl(x + column, y, char, style);
                column += 1;
            }

            markDirty(y);
        },

        drawVBar: (x, y, h, fillRatio, style) => {
            if (h <= 0 || x < 0 || x >= width) {
                return;
            }

            const ratio = Math.max(0, Math.min(1, fillRatio));
            const total = h * V_BAR_GLYPHS.length;
            const filled = Math.round(ratio * total);
            const fullRows = Math.floor(filled / V_BAR_GLYPHS.length);
            const remainder = filled % V_BAR_GLYPHS.length;

            // Bars grow from the bottom up.
            for (let row = 0; row < h; row += 1) {
                const distanceFromBottom = h - row - 1;
                const py = y + row;

                if (distanceFromBottom < fullRows) {
                    setCellImpl(x, py, FULL_BLOCK, style);
                } else if (distanceFromBottom === fullRows && remainder > 0) {
                    setCellImpl(x, py, V_BAR_GLYPHS[remainder - 1]!, style);
                } else {
                    setCellImpl(x, py, SPACE_CODEPOINT, style);
                }

                markDirty(py);
            }
        },

        height,
        setCell: setCellImpl,
        width,
    };

    return {
        bg,
        chars,
        colorDecoder: decode,
        context,
        dirty,
        fg,
        height,
        styles,
        width,
    };
};

/**
 * Serialize a buffer row into an ANSI string, coalescing adjacent cells that
 * share the same style. Call directly when you need to re-emit rows; row
 * caching lives one level up in Canvas.tsx.
 */
export const serializeRow = (buffer: CanvasBuffer, row: number): string => {
    const { bg, chars, colorDecoder, fg, styles, width } = buffer;
    const base = row * width;

    let output = "";
    let spanStart = 0;
    let spanStyles = styles[base]!;
    let spanFg = fg[base]!;
    let spanBg = bg[base]!;

    const flush = (end: number): void => {
        let text = "";

        for (let index = spanStart; index < end; index += 1) {
            text += String.fromCodePoint(chars[base + index]!);
        }

        const fgColor = colorDecoder(spanFg);
        const bgColor = colorDecoder(spanBg);

        let rendered = text;

        if (fgColor !== undefined && fgColor !== null) {
            rendered = colorize(rendered, typeof fgColor === "number" ? String(fgColor) : fgColor, "foreground");
        }

        if (bgColor !== undefined && bgColor !== null) {
            rendered = colorize(rendered, typeof bgColor === "number" ? String(bgColor) : bgColor, "background");
        }

        if ((spanStyles & STYLE_BOLD) !== 0) {
            rendered = `\u001B[1m${rendered}\u001B[22m`;
        }

        if ((spanStyles & STYLE_DIM) !== 0) {
            rendered = `\u001B[2m${rendered}\u001B[22m`;
        }

        output += rendered;
    };

    for (let column = 1; column < width; column += 1) {
        const nextStyles = styles[base + column]!;
        const nextFg = fg[base + column]!;
        const nextBg = bg[base + column]!;

        if (nextStyles !== spanStyles || nextFg !== spanFg || nextBg !== spanBg) {
            flush(column);
            spanStart = column;
            spanStyles = nextStyles;
            spanFg = nextFg;
            spanBg = nextBg;
        }
    }

    flush(width);

    return output;
};
