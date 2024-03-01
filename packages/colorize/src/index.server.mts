import ColorizeImpl from "./colorize.server";
import type { ColorizeType } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

// eslint-disable-next-line import/no-default-export
export default colorize as ColorizeType;

// eslint-disable-next-line import/no-unused-modules
export const {
    ansi256,
    bg,
    bgAnsi256,
    bgBlack,
    bgBlackBright,
    bgBlue,
    bgBlueBright,
    bgCyan,
    bgCyanBright,
    bgGray,
    bgGreen,
    bgGreenBright,
    bgGrey,
    bgHex,
    bgMagenta,
    bgMagentaBright,
    bgRed,
    bgRedBright,
    bgRgb,
    bgWhite,
    bgWhiteBright,
    bgYellow,
    bgYellowBright,
    black,
    blackBright,
    blue,
    blueBright,
    bold,
    cyan,
    cyanBright,
    dim,
    fg,
    gray,
    green,
    greenBright,
    grey,
    hex,
    hidden,
    inverse,
    italic,
    magenta,
    magentaBright,
    overline,
    red,
    redBright,
    reset,
    rgb,
    strike,
    strikethrough,
    strip,
    underline,
    visible,
    white,
    whiteBright,
    yellow,
    yellowBright,
} = colorize;

export const Colorize = ColorizeImpl;

// eslint-disable-next-line import/no-unused-modules
export type { AnsiColors, AnsiStyles, ColorizeType } from "./types";
