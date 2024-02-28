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
 *
 * @param {string} hex A string that contains the hexadecimal RGB color representation.
 * @return {[number, number, number]} The red, green, blue values in range [0, 255] .
 */
// eslint-disable-next-line import/no-unused-modules
export const hexToRgb = (hex: string): [number, number, number] => {
    let color: string = hex.replace("#", "");

    if (color.length === 3) {
        color = (color[0] as string) + (color[0] as string) + (color[1] as string) + (color[1] as string) + (color[2] as string) + (color[2] as string);
    } else if (color.length !== 6) {
        return [0, 0, 0];
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const number_ = Number.parseInt(color, 16);

    // eslint-disable-next-line no-bitwise
    return [(number_ >> 16) & 255, (number_ >> 8) & 255, number_ & 255];
};
