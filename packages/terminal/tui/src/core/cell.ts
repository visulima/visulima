/* eslint-disable jsdoc/lines-before-block, jsdoc/match-description, no-bitwise */
/**
 * 2×u32 per-cell back-buffer layout:
 *   buffer[idx * 2]     = charCode  (Unicode codepoint, u32)
 *   buffer[idx * 2 + 1] = attrCode  = (styles &lt;< 16) | (bg &lt;< 8) | fg
 */
export const Cell = {
    /** Read bg color from an attr slot value (buffer[idx*2+1]) — bits 15:8 */
    getBg(attributeSlot: number): number {
        return (attributeSlot >> 8) & 0xff;
    },

    /** Read the char character from a raw char slot value (buffer[idx*2]) */
    getChar(charSlot: number): string {
        if (charSlot === 0) {
            return " ";
        }

        if (charSlot > 0x10_ff_ff) {
            return "";
        }

        return String.fromCodePoint(charSlot);
    },

    /** Read fg color from an attr slot value (buffer[idx*2+1]) — bits 7:0 */
    getFg(attributeSlot: number): number {
        return attributeSlot & 0xff;
    },

    /** Read styles bitmask from an attr slot value (buffer[idx*2+1]) — bits 23:16 */
    getStyles(attributeSlot: number): number {
        return (attributeSlot >> 16) & 0xff;
    },

    /**
     * Pack a cell into a [charCode, attrCode] tuple.
     * charCode = char.codePointAt(0)
     * attrCode = (styles & 0xFF) &lt;< 16 | (bg & 0xFF) &lt;< 8 | (fg & 0xFF)
     *
     * Write to buffer as: buffer[idx*2] = charCode; buffer[idx*2+1] = attrCode
     */
    pack(char: string, fg: number = 255, bg: number = 255, styles: number = 0): [number, number] {
        const charCode = char.codePointAt(0) ?? 32;
        const attributeCode = ((styles & 0xff) << 16) | ((bg & 0xff) << 8) | (fg & 0xff);

        return [charCode, attributeCode];
    },
};

export const StyleMasks = {
    BLINK: 16,
    BOLD: 1,
    DIM: 2,
    HIDDEN: 64,
    INVERT: 32,
    ITALIC: 4,
    STRIKETHROUGH: 128,
    UNDERLINE: 8,
};
