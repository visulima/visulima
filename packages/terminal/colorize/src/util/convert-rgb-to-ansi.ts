/**
 * Copy of https://github.com/Qix-/color-convert/blob/master/conversions.js#L551
 *
 * MIT License
 *
 * Copyright (c) 2011-2016 Heather Arthur &lt;fayearthur@gmail.com>.
 * Copyright (c) 2016-2021 Josh Junon &lt;josh@junon.me>.
 */

/**
 * Convert RGB values to approximate code of ANSI 256 colors.
 *
 */
export const rgbToAnsi256 = (r: number, g: number, b: number): number => {
    // greyscale
    if (r === g && g === b) {
        if (r < 8) {
            return 16;
        }

        if (r > 248) {
            return 231;
        }

        return Math.round(((r - 8) / 247) * 24) + 232;
    }

    return (
        16
        // r / 255 * 5 => r / 51
        + 36 * Math.round(r / 51)
        + 6 * Math.round(g / 51)
        + Math.round(b / 51)
    );
};

/**
 * Convert ANSI 256 color code to approximate code of ANSI 16 colors.
 */
export const ansi256To16 = (code: number): number => {
    let r;
    let g;
    let b;

    if (code < 8) {
        return 30 + code;
    }

    if (code < 16) {
        return 90 + (code - 8);
    }

    if (code >= 232) {
        // greyscale
        // eslint-disable-next-line no-multi-assign
        r = g = b = ((code - 232) * 10 + 8) / 255;
    } else {
        // eslint-disable-next-line no-param-reassign
        code -= 16;

        const remainder = code % 36;

        r = Math.floor(code / 36) / 5;
        g = Math.floor(remainder / 6) / 5;
        b = (remainder % 6) / 5;
    }

    const value = Math.max(r, g, b) * 2;

    if (value === 0) {
        return 30;
    }

    // eslint-disable-next-line no-bitwise
    const code16 = 30 + ((Math.round(b) << 2) | (Math.round(g) << 1) | Math.round(r));

    return value === 2 ? code16 + 60 : code16;
};

export const rgbToAnsi16 = (r: number, g: number, b: number): number => ansi256To16(rgbToAnsi256(r, g, b));
