/**
 * Modified copy of https://github.com/webdiscus/ansis/blob/master/src/ansi-codes.js
 *
 * ISC License
 *
 * Copyright (c) 2023, webdiscus
 */

import type { ColorSupportLevel } from "@visulima/is-ansi-color-supported";
import { isStdoutColorSupported } from "@visulima/is-ansi-color-supported";

import type { AnsiColors, AnsiStyles, ColorData, ColorValueHex } from "./types";
import { clamp } from "./util/clamp";
import { convertHexToRgb } from "./util/convert-hex-to-rgb";
import { ansi256To16, rgbToAnsi16, rgbToAnsi256 } from "./util/convert-rgb-to-ansi";

const closeCode = 39;
const bgCloseCode = 49;
const bgOffset = 10;

const supportedColor: ColorSupportLevel = isStdoutColorSupported();

const mono = { close: "", open: "" };

const esc: (open: number | string, close: number | string) => ColorData
    = supportedColor > 0
        ? (open: number | string, close: number | string): ColorData => {
            return { close: `\u001B[${close}m`, open: `\u001B[${open}m` };
        }
        : (): ColorData => mono;

const createRgbFunction = (function_: (code: number | string) => ColorData) => (r: number | string, g: number | string, b: number | string) =>
    function_(rgbToAnsi256(Number(r), Number(g), Number(b)));

const createHexFunction = (function_: (r: number | string, g: number | string, b: number | string) => ColorData) => (hex: ColorValueHex) => {
    const [r, g, b] = convertHexToRgb(hex);

    return function_(r, g, b);
};

let createAnsi256 = (code: number | string): ColorData => esc(`38;5;${code}`, closeCode);

let createBgAnsi256 = (code: number | string): ColorData => esc(`48;5;${code}`, bgCloseCode);

let createRgb = (r: number | string, g: number | string, b: number | string): ColorData => esc(`38;2;${r};${g};${b}`, closeCode);

let createBgRgb = (r: number | string, g: number | string, b: number | string): ColorData => esc(`48;2;${r};${g};${b}`, bgCloseCode);

if (supportedColor === 1) {
    // ANSI 16 colors
    createAnsi256 = (code: number | string) => esc(ansi256To16(Number(code)), closeCode);
    createBgAnsi256 = (code: number | string) => esc(ansi256To16(Number(code)) + bgOffset, bgCloseCode);
    createRgb = (r: number | string, g: number | string, b: number | string) => esc(rgbToAnsi16(Number(r), Number(g), Number(b)), closeCode);
    createBgRgb = (r: number | string, g: number | string, b: number | string) => esc(rgbToAnsi16(Number(r), Number(g), Number(b)) + bgOffset, bgCloseCode);
} else if (supportedColor === 2) {
    // ANSI 256 colors
    createRgb = createRgbFunction(createAnsi256);
    createBgRgb = createRgbFunction(createBgAnsi256);
}

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
    visible: mono,
};

export const baseColors: Required<Record<AnsiColors, ColorData>> = {
    bgBlack: esc(40, bgCloseCode),
    bgBlackBright: esc(100, bgCloseCode),
    bgBlue: esc(44, bgCloseCode),
    bgBlueBright: esc(104, bgCloseCode),
    bgCyan: esc(46, bgCloseCode),
    bgCyanBright: esc(106, bgCloseCode),
    bgGray: esc(100, bgCloseCode), // US spelling alias for bgBlackBright
    bgGreen: esc(42, bgCloseCode),
    bgGreenBright: esc(102, bgCloseCode),
    bgGrey: esc(100, bgCloseCode), // UK spelling alias for bgBlackBright
    bgMagenta: esc(45, bgCloseCode),
    bgMagentaBright: esc(105, bgCloseCode),
    bgRed: esc(41, bgCloseCode),
    bgRedBright: esc(101, bgCloseCode),
    bgWhite: esc(47, bgCloseCode),
    bgWhiteBright: esc(107, bgCloseCode),
    bgYellow: esc(43, bgCloseCode),
    bgYellowBright: esc(103, bgCloseCode),
    black: esc(30, closeCode),
    blackBright: esc(90, closeCode),
    blue: esc(34, closeCode),
    blueBright: esc(94, closeCode),
    cyan: esc(36, closeCode),
    cyanBright: esc(96, closeCode),
    gray: esc(90, closeCode), // US spelling alias for blackBright
    green: esc(32, closeCode),
    greenBright: esc(92, closeCode),
    grey: esc(90, closeCode), // UK spelling alias for blackBright
    magenta: esc(35, closeCode),
    magentaBright: esc(95, closeCode),
    red: esc(31, closeCode),
    redBright: esc(91, closeCode),
    white: esc(37, closeCode),
    whiteBright: esc(97, closeCode),
    yellow: esc(33, closeCode),
    yellowBright: esc(93, closeCode),
};

export const styleMethods: {
    bg: (code: number) => ColorData;
    bgHex: (hex: ColorValueHex) => ColorData;
    bgRgb: (r: number, g: number, b: number) => ColorData;
    fg: (code: number) => ColorData;
    hex: (hex: ColorValueHex) => ColorData;
    rgb: (r: number, g: number, b: number) => ColorData;
} = {
    bg: (code) => createBgAnsi256(clamp(code, 0, 255)),

    bgHex: createHexFunction(createBgRgb),

    bgRgb: (r, g, b) => createBgRgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)),

    fg: (code) => createAnsi256(clamp(code, 0, 255)),

    hex: createHexFunction(createRgb),

    rgb: (r, g, b) => createRgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)),
};
