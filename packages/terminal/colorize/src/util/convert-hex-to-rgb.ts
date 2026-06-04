/**
 * Modified copy of https://github.com/webdiscus/ansis/blob/master/src/utils.js
 *
 * ISC License
 *
 * Copyright (c) 2023, webdiscus
 */

/**
 * Convert hex color string to RGB values.
 *
 * A hexadecimal color code can be 3 or 6 digits with an optional "#" prefix.
 *
 * The 3 digits specifies an RGB doublet data as a fully opaque color.
 * For example, "#123" specifies the color that is represented by "#112233".
 *
 * The 6 digits specifies a fully opaque color.
 * For example, "#112233".
 * @param {string} hex A string that contains the hexadecimal RGB color representation.
 * @returns {[number, number, number]} The red, green, blue values in range [0, 255] .
 */

const HEX_COLOR_REGEX = /^#?([a-f\d]{3}|[a-f\d]{6})$/i;

// eslint-disable-next-line import/prefer-default-export -- public API uses named export
export const convertHexToRgb = (hex: string): [number, number, number] => {
    let [, color] = HEX_COLOR_REGEX.exec(hex) ?? [];

    const colorLength = color ? color.length : 0;

    if (colorLength === 3) {
        const c0 = (color as string).charAt(0);
        const c1 = (color as string).charAt(1);
        const c2 = (color as string).charAt(2);

        color = c0 + c0 + c1 + c1 + c2 + c2;
    } else if (colorLength !== 6) {
        return [0, 0, 0];
    }

    const colorNumber = Number.parseInt(color as string, 16);

    // eslint-disable-next-line no-bitwise
    return [(colorNumber >> 16) & 255, (colorNumber >> 8) & 255, colorNumber & 255];
};
