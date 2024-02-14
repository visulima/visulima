import ColorizeImpl from "./colorize.browser";
import type { ColorizeType } from "./types";
import { isColorSupported } from "@visulima/is-ansi-color-supported";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

let consoleOverwritten = false;

// Heck the window.console object to add colorized logging
if (isColorSupported() === 0 && !consoleOverwritten) {
    const originalConsole = { ...window.console };

    ["error", "group", "groupCollapsed", "info", "log", "trace", "warn"].forEach((o) => {
        (window.console as any)[o as keyof Console] = (...args: any[]) => {
            if (Array.isArray(args[0]) && args[0].length >= 2 && args[0][0].includes("%c")) {
                (originalConsole as any)[o](...args[0]);
            } else {
                (originalConsole as any)[o](...args);
            }
        };
    });

    consoleOverwritten = true;
}

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

export { default as Colorize } from "./colorize.browser";

// eslint-disable-next-line import/no-unused-modules
export type { AnsiColors, AnsiStyles, ColorizeType } from "./types";
