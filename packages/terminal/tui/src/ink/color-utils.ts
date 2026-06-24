/**
 * Shared color lookup tables and parsing utilities.
 *
 * Used by styled-line-serializer.ts, styled-line-factory.ts, and output.ts
 * to avoid triplicate color mapping code.
 */

/* eslint-disable no-bitwise */

/** Standard ANSI color names to 0-7 index */
export const NAMED_COLORS: Readonly<Record<string, number>> = {
    black: 0,
    blue: 4,
    cyan: 6,
    gray: 8,
    green: 2,
    grey: 8,
    magenta: 5,
    red: 1,
    white: 7,
    yellow: 3,
};

/** Bright ANSI color names to 8-15 index */
export const BRIGHT_COLORS: Readonly<Record<string, number>> = {
    blackBright: 8,
    blueBright: 12,
    cyanBright: 14,
    greenBright: 10,
    magentaBright: 13,
    redBright: 9,
    whiteBright: 15,
    yellowBright: 11,
};

const ansi256Regex = /^ansi256\(\s?(\d+)\s?\)$/;
const rgbRegex = /^rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)$/;

/**
 * Parse a color string into an ANSI 256-color index (0-255).
 * Returns 255 (default) for unrecognized colors.
 */
export const colorToAnsi256 = (color: string): number => {
    const named = NAMED_COLORS[color];

    if (named !== undefined) {
        return named;
    }

    const bright = BRIGHT_COLORS[color];

    if (bright !== undefined) {
        return bright;
    }

    const ansi256Match = ansi256Regex.exec(color);

    if (ansi256Match) {
        return Number(ansi256Match[1]) & 0xff;
    }

    if (color.startsWith("#") && color.length === 7) {
        const r = Number.parseInt(color.slice(1, 3), 16);
        const g = Number.parseInt(color.slice(3, 5), 16);
        const b = Number.parseInt(color.slice(5, 7), 16);

        return 16 + 36 * Math.round(r / 51) + 6 * Math.round(g / 51) + Math.round(b / 51);
    }

    const rgbMatch = rgbRegex.exec(color);

    if (rgbMatch) {
        return 16 + 36 * Math.round(Number(rgbMatch[1]) / 51) + 6 * Math.round(Number(rgbMatch[2]) / 51) + Math.round(Number(rgbMatch[3]) / 51);
    }

    return 255;
};

/**
 * Convert a color string to SGR parameter array for escape sequences.
 * @param color the color string to convert
 * @param isFg true for foreground (30-based), false for background (40-based)
 */
export const colorToSgrParams = (color: string, isFg: boolean): number[] => {
    const base = isFg ? 30 : 40;

    const named = NAMED_COLORS[color];

    if (named !== undefined) {
        return [base + named];
    }

    const bright = BRIGHT_COLORS[color];

    if (bright !== undefined) {
        return [base + 60 + (bright - 8)];
    }

    if (color.startsWith("#") && color.length === 7) {
        const r = Number.parseInt(color.slice(1, 3), 16);
        const g = Number.parseInt(color.slice(3, 5), 16);
        const b = Number.parseInt(color.slice(5, 7), 16);

        return [isFg ? 38 : 48, 2, r, g, b];
    }

    const ansi256Match = ansi256Regex.exec(color);

    if (ansi256Match) {
        return [isFg ? 38 : 48, 5, Number(ansi256Match[1])];
    }

    const rgbMatch = rgbRegex.exec(color);

    if (rgbMatch) {
        return [isFg ? 38 : 48, 2, Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
    }

    return [];
};

/**
 * Convert an ANSI 256-color index to a named color string.
 * Standard colors (0-7) use names; everything else uses ansi256(N).
 */
export const ansi256ToColorName = (index: number): string => {
    const standardNames = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

    if (index >= 0 && index <= 7) {
        return standardNames[index]!;
    }

    return `ansi256(${index})`;
};
