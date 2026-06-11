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
 * Invalid input (anything that is not a 3- or 6-digit hex string with an optional
 * `#` prefix) falls back to black `[0, 0, 0]`. In a non-production environment a
 * `console.warn` is emitted so the silent-black fallback does not go unnoticed
 * during development.
 * @param {string} hex A string that contains the hexadecimal RGB color representation.
 * @returns {[number, number, number]} The red, green, blue values in range [0, 255] .
 * @example
 * ```ts
 * convertHexToRgb("#96C");    // [153, 102, 204]
 * convertHexToRgb("#E0115F"); // [224, 17, 95]
 * convertHexToRgb("#GGG");    // [0, 0, 0] (+ dev warning)
 * ```
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
        // The string did not match a valid 3/6-digit hex color. Warn during
        // development so the silent black fallback is discoverable, then return black.
        // `process` is referenced via globalThis so this file stays usable in both the
        // node and browser builds (the browser tsconfig has no node types).
        const environment = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;

        if (environment?.env?.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.warn(`[@visulima/colorize] Invalid hex color "${hex}"; expected a 3- or 6-digit hex string (e.g. "#96C" or "#E0115F"). Falling back to black.`);
        }

        return [0, 0, 0];
    }

    const colorNumber = Number.parseInt(color as string, 16);

    // eslint-disable-next-line no-bitwise
    return [(colorNumber >> 16) & 255, (colorNumber >> 8) & 255, colorNumber & 255];
};
