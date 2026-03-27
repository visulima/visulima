/**
 * 2×u32 per-cell back-buffer layout:
 *   buffer[idx * 2]     = charCode  (Unicode codepoint, u32)
 *   buffer[idx * 2 + 1] = attrCode  = (styles << 16) | (bg << 8) | fg
 */
export const Cell = {
    /**
     * Pack a cell into a [charCode, attrCode] tuple.
     * charCode = char.codePointAt(0)
     * attrCode = (styles & 0xFF) << 16 | (bg & 0xFF) << 8 | (fg & 0xFF)
     *
     * Write to buffer as: buffer[idx*2] = charCode; buffer[idx*2+1] = attrCode
     */
    pack(char: string, fg: number = 255, bg: number = 255, styles: number = 0): [number, number] {
        const charCode = char.codePointAt(0) ?? 32;
        const attrCode = ((styles & 0xff) << 16) | ((bg & 0xff) << 8) | (fg & 0xff);
        return [charCode, attrCode];
    },

    /** Read the char character from a raw char slot value (buffer[idx*2]) */
    getChar(charSlot: number): string {
        if (charSlot === 0) return " ";
        if (charSlot > 0x10ffff) return "";
        return String.fromCodePoint(charSlot);
    },

    /** Read fg color from an attr slot value (buffer[idx*2+1]) — bits 7:0 */
    getFg(attrSlot: number): number {
        return attrSlot & 0xff;
    },

    /** Read bg color from an attr slot value (buffer[idx*2+1]) — bits 15:8 */
    getBg(attrSlot: number): number {
        return (attrSlot >> 8) & 0xff;
    },

    /** Read styles bitmask from an attr slot value (buffer[idx*2+1]) — bits 23:16 */
    getStyles(attrSlot: number): number {
        return (attrSlot >> 16) & 0xff;
    },
};

export const StyleMasks = {
    BOLD: 1,
    DIM: 2,
    ITALIC: 4,
    UNDERLINE: 8,
    BLINK: 16,
    INVERT: 32,
    HIDDEN: 64,
    STRIKETHROUGH: 128,
};
