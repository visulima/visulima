/* eslint-disable prefer-destructuring */
import ColorizeImpl, { stderrColorLevel } from "./colorize.server";
import type { ColorizeType, ColorValueHex } from "./types";

/**
 * The default Colorize instance, auto-detecting the stdout color-support level.
 * Use the named exports (`red`, `bold`, `hex`, …) for chaining, or this default
 * export directly: `colorize.red.bold("text")`.
 * @example
 * ```ts
 * import colorize from "@visulima/colorize";
 *
 * console.log(colorize.red.bold("error"));
 * ```
 */
const colorize: ColorizeType = new ColorizeImpl();

export default colorize;

/**
 * A Colorize instance bound to the stderr color-support level. stdout and stderr
 * can have different TTY capabilities (e.g. `node app > out.txt` leaves stderr a
 * TTY while stdout is a file), so prefer this for styling error output.
 * @example
 * ```ts
 * import { colorizeStderr } from "@visulima/colorize";
 *
 * console.error(colorizeStderr.red("failed"));
 * ```
 */
export const colorizeStderr: ColorizeType = new ColorizeImpl({ level: stderrColorLevel });

// Extract methods that return 'this'

/**
 * Set a [256-color ANSI code](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit) foreground color.
 * @param {number} code in range [0, 255].
 * @example ansi256(93)("violet text")
 */
export const ansi256: (code: number) => ColorizeType = colorize.ansi256;

/** Alias for {@link bgAnsi256}. Set a 256-color ANSI background color in range [0, 255]. */
export const bg: (code: number) => ColorizeType = colorize.bg;

/**
 * Set a [256-color ANSI code](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit) background color.
 * @param {number} code in range [0, 255].
 */
export const bgAnsi256: (code: number) => ColorizeType = colorize.bgAnsi256;

/**
 * Set a HEX background color.
 * @param {string} color e.g. `"#E0115F"` or `"#96C"`.
 * @example bgHex("#96C")("text on amethyst")
 */
export const bgHex: (color: ColorValueHex) => ColorizeType = colorize.bgHex;

/**
 * Set an RGB background color.
 * @param {number} red red value in range [0, 255].
 * @param {number} green green value in range [0, 255].
 * @param {number} blue blue value in range [0, 255].
 */
export const bgRgb: (red: number, green: number, blue: number) => ColorizeType = colorize.bgRgb;

/** Alias for {@link ansi256}. Set a 256-color ANSI foreground color in range [0, 255]. */
export const fg: (code: number) => ColorizeType = colorize.fg;

/**
 * Set a HEX foreground color.
 * @param {string} color e.g. `"#E0115F"` or `"#96C"`. Invalid input falls back to black.
 * @example hex("#FFAB40")("orange text")
 */
export const hex: (color: ColorValueHex) => ColorizeType = colorize.hex;

/**
 * Set an RGB foreground color.
 * @param {number} red red value in range [0, 255].
 * @param {number} green green value in range [0, 255].
 * @param {number} blue blue value in range [0, 255].
 * @example rgb(224, 17, 95)("Ruby")
 */
export const rgb: (red: number, green: number, blue: number) => ColorizeType = colorize.rgb;

/**
 * Remove all ANSI styling codes from a string.
 * @param {string} string the string to strip.
 * @returns {string} the plain string without ANSI escape codes.
 * @example strip(red("error")) // "error"
 */
export const strip: (string: string) => string = colorize.strip;

// Extract readonly properties that are 'this'
export const bgBlack: ColorizeType = colorize.bgBlack;
export const bgBlackBright: ColorizeType = colorize.bgBlackBright;
export const bgBlue: ColorizeType = colorize.bgBlue;
export const bgBlueBright: ColorizeType = colorize.bgBlueBright;
export const bgCyan: ColorizeType = colorize.bgCyan;
export const bgCyanBright: ColorizeType = colorize.bgCyanBright;
export const bgGray: ColorizeType = colorize.bgGray;
export const bgGreen: ColorizeType = colorize.bgGreen;
export const bgGreenBright: ColorizeType = colorize.bgGreenBright;
export const bgGrey: ColorizeType = colorize.bgGrey;
export const bgMagenta: ColorizeType = colorize.bgMagenta;
export const bgMagentaBright: ColorizeType = colorize.bgMagentaBright;
export const bgRed: ColorizeType = colorize.bgRed;
export const bgRedBright: ColorizeType = colorize.bgRedBright;
export const bgWhite: ColorizeType = colorize.bgWhite;
export const bgWhiteBright: ColorizeType = colorize.bgWhiteBright;
export const bgYellow: ColorizeType = colorize.bgYellow;
export const bgYellowBright: ColorizeType = colorize.bgYellowBright;
export const black: ColorizeType = colorize.black;
export const blackBright: ColorizeType = colorize.blackBright;
export const blue: ColorizeType = colorize.blue;
export const blueBright: ColorizeType = colorize.blueBright;
export const bold: ColorizeType = colorize.bold;
export const cyan: ColorizeType = colorize.cyan;
export const cyanBright: ColorizeType = colorize.cyanBright;
export const dim: ColorizeType = colorize.dim;
export const gray: ColorizeType = colorize.gray;
export const green: ColorizeType = colorize.green;
export const greenBright: ColorizeType = colorize.greenBright;
export const grey: ColorizeType = colorize.grey;
export const hidden: ColorizeType = colorize.hidden;
export const inverse: ColorizeType = colorize.inverse;
export const italic: ColorizeType = colorize.italic;
export const magenta: ColorizeType = colorize.magenta;
export const magentaBright: ColorizeType = colorize.magentaBright;
export const overline: ColorizeType = colorize.overline;
export const red: ColorizeType = colorize.red;
export const redBright: ColorizeType = colorize.redBright;
export const reset: ColorizeType = colorize.reset;
export const strike: ColorizeType = colorize.strike;
export const strikethrough: ColorizeType = colorize.strikethrough;
export const underline: ColorizeType = colorize.underline;
export const visible: ColorizeType = colorize.visible;
export const white: ColorizeType = colorize.white;
export const whiteBright: ColorizeType = colorize.whiteBright;
export const yellow: ColorizeType = colorize.yellow;
export const yellowBright: ColorizeType = colorize.yellowBright;

export type { ColorizeOptions } from "./colorize.server";
export { default as Colorize } from "./colorize.server";
export type { AnsiColors, AnsiStyles, ColorizeType } from "./types";
