/* eslint-disable prefer-destructuring */
import ColorizeImpl from "./colorize.browser";
import type { ColorizeType, ColorValueHex } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

export default colorize as ColorizeType;

// Extract methods that return 'this'
export const ansi256: (code: number) => ColorizeType = colorize.ansi256;
export const bg: (code: number) => ColorizeType = colorize.bg;
export const bgAnsi256: (code: number) => ColorizeType = colorize.bgAnsi256;
export const bgHex: (color: ColorValueHex) => ColorizeType = colorize.bgHex;
export const bgRgb: (red: number, green: number, blue: number) => ColorizeType = colorize.bgRgb;
export const fg: (code: number) => ColorizeType = colorize.fg;
export const hex: (color: ColorValueHex) => ColorizeType = colorize.hex;
export const rgb: (red: number, green: number, blue: number) => ColorizeType = colorize.rgb;
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

export { default as Colorize } from "./colorize.browser";
export type { AnsiColors, AnsiStyles, ColorizeType } from "./types";
