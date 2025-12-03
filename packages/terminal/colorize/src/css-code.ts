import type { AnsiColors, AnsiStyles } from "./types";
import { ansiCodeHexMap } from "./util/ansi-code-hex-map";

export const baseStyles: Required<Record<AnsiStyles, string>> = {
    bold: "font-weight: bold;",
    dim: "opacity: 0.5;",
    hidden: "visibility: hidden;",
    inverse: "background-color: currentColor; color: background-color;",
    italic: "font-style: italic;",
    overline: "text-decoration: overline;",
    reset: "color: inherit",
    strike: "text-decoration: line-through;",
    strikethrough: "text-decoration: line-through;",
    underline: "text-decoration: underline;",
    visible: "opacity: 0;",
};

export const baseColors: Required<Record<AnsiColors, string>> = {
    bgBlack: "background-color: black; color: white;",
    bgBlackBright: "background-color: #666; color: white;",
    bgBlue: "background-color: blue; color: white;",
    bgBlueBright: "background-color: #55f; color: white;",
    bgCyan: "background-color: cyan; color: black;",
    bgCyanBright: "background-color: #5ff; color: black;",
    bgGray: "background-color: #666; color: white;", // US spelling alias for bgBlackBright
    bgGreen: "background-color: green; color: white;",
    bgGreenBright: "background-color: #5f5; color: white;",
    bgGrey: "background-color: #666; color: white;", // UK spelling alias for bgBlackBright
    bgMagenta: "background-color: magenta; color: white;",
    bgMagentaBright: "background-color: #f5f; color: white;",
    bgRed: "background-color: red; color: white;",
    bgRedBright: "background-color: #f55; color: white;",
    bgWhite: "background-color: white; color: black;",
    bgWhiteBright: "background-color: #eee; color: black;",
    bgYellow: "background-color: yellow; color: black;",
    bgYellowBright: "background-color: #ff5; color: black;",
    black: "color: black;",
    blackBright: "color: #666;",
    blue: "color: blue;",
    blueBright: "color: #55f;",
    cyan: "color: cyan;",
    cyanBright: "color: #5ff;",
    gray: "color: #666;", // US spelling alias for blackBright
    green: "color: green;",
    greenBright: "color: #5f5;",
    grey: "color: #666;", // UK spelling alias for blackBright
    magenta: "color: magenta;",
    magentaBright: "color: #f5f;",
    red: "color: red;",
    redBright: "color: #f55;",
    white: "color: white;",
    whiteBright: "color: #eee;",
    yellow: "color: yellow;",
    yellowBright: "color: #ff5;",
};

export const styleMethods: {
    bg: (code: number) => string;
    bgHex: (hex: string) => string;
    bgRgb: (r: number, g: number, b: number) => string;
    fg: (code: number) => string;
    hex: (hex: string) => string;
    rgb: (r: number, g: number, b: number) => string;
} = {
    // eslint-disable-next-line security/detect-object-injection
    bg: (code: number) => `background-color: ${ansiCodeHexMap[code]};`,
    bgHex: (hex: string) => `background-color: ${hex};`,
    bgRgb: (r: number, g: number, b: number) => `background-color: rgb(${r},${g},${b});`,
    // eslint-disable-next-line security/detect-object-injection
    fg: (code: number) => `color: ${ansiCodeHexMap[code]};`,
    hex: (hex: string) => `color:${hex};`,
    rgb: (r: number, g: number, b: number) => `color: rgb(${r},${g},${b});`,
};
