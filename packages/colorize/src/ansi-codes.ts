/**
 * Modified copy of https://github.com/webdiscus/ansis/blob/master/src/ansi-codes.js
 *
 * ISC License
 *
 * Copyright (c) 2023, webdiscus
 */

import { isStdoutColorSupported } from "@visulima/is-ansi-color-supported";

import type { AnsiColors, AnsiStyles, ColorData, ColorValueHex } from "./types";
import { clamp } from "./util/clamp";
import { hexToRgb } from "./util/hex-to-rgb";

const esc: (open: number | string, close: number | string) => ColorData =
    isStdoutColorSupported() > 0
        ? (open: number | string, close: number | string): ColorData => {
              return { close: "\u001B[" + close + "m", open: "\u001B[" + open + "m" };
          }
        : (): ColorData => {
              return { close: "", open: "" };
          };

const createAnsi256 = (code: number | string): ColorData => esc("38;5;" + code, 39);

const createBgAnsi256 = (code: number | string): ColorData => esc("48;5;" + code, 49);

const createRgb = (r: number | string, g: number | string, b: number | string): ColorData => esc("38;2;" + r + ";" + g + ";" + b, 39);

const createBgRgb = (r: number | string, g: number | string, b: number | string): ColorData => esc("48;2;" + r + ";" + g + ";" + b, 49);

export const baseStyles: Required<Record<AnsiStyles, ColorData>> = {
    // 21 isn't widely supported and 22 does the same thing
    bold: esc(1, 22),
    dim: esc(2, 22),
    hidden: esc(8, 28),
    inverse: esc(7, 27),
    italic: esc(3, 23),
    overline: esc(53, 55),
    reset: esc(0, 0),
    strike: esc(9, 29), // alias for strikethrough
    strikethrough: esc(9, 29),
    underline: esc(4, 24),
    visible: { close: "", open: "" },
};

export const baseColors: Required<Record<AnsiColors, ColorData>> = {
    bgBlack: esc(40, 49),
    bgBlackBright: esc(100, 49),
    bgBlue: esc(44, 49),
    bgBlueBright: esc(104, 49),
    bgCyan: esc(46, 49),
    bgCyanBright: esc(106, 49),
    bgGray: esc(100, 49), // US spelling alias for bgBlackBright
    bgGreen: esc(42, 49),
    bgGreenBright: esc(102, 49),
    bgGrey: esc(100, 49), // UK spelling alias for bgBlackBright
    bgMagenta: esc(45, 49),
    bgMagentaBright: esc(105, 49),
    bgRed: esc(41, 49),
    bgRedBright: esc(101, 49),
    bgWhite: esc(47, 49),
    bgWhiteBright: esc(107, 49),
    bgYellow: esc(43, 49),
    bgYellowBright: esc(103, 49),
    black: esc(30, 39),
    blackBright: esc(90, 39),
    blue: esc(34, 39),
    blueBright: esc(94, 39),
    cyan: esc(36, 39),
    cyanBright: esc(96, 39),
    gray: esc(90, 39), // US spelling alias for blackBright
    green: esc(32, 39),
    greenBright: esc(92, 39),
    grey: esc(90, 39), // UK spelling alias for blackBright
    magenta: esc(35, 39),
    magentaBright: esc(95, 39),
    red: esc(31, 39),
    redBright: esc(91, 39),
    white: esc(37, 39),
    whiteBright: esc(97, 39),
    yellow: esc(33, 39),
    yellowBright: esc(93, 39),
};

export const styleMethods: {
    bg: (code: number) => ColorData;
    bgHex: (hex: ColorValueHex) => ColorData;
    bgRgb: (r: number, g: number, b: number) => ColorData;
    fg: (code: number) => ColorData;
    hex: (hex: ColorValueHex) => ColorData;
    rgb: (r: number, g: number, b: number) => ColorData;
} = {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    bg: (code) => createBgAnsi256(clamp(code, 0, 255)),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    bgHex: (hex) => createBgRgb(...hexToRgb(hex)),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    bgRgb: (r, g, b) => createBgRgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    fg: (code) => createAnsi256(clamp(code, 0, 255)),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    hex: (hex) => createRgb(...hexToRgb(hex)),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    rgb: (r, g, b) => createRgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)),
};
