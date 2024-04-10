/**
 * This is a modified copy of the ansi256.js from ansis.
 * @see https://github.com/webdiscus/ansis/blob/master/examples/ansis-styles-demo.js
 *
 * ISC License
 *
 * Copyright (c) 2023, webdiscus
 */

"use strict";

import {
    bgBlue,
    bgBlueBright,
    black,
    blue,
    blueBright,
    cyan,
    cyanBright,
    dim,
    gray,
    green,
    greenBright,
    bold,
    inverse,
    italic,
    magenta,
    magentaBright,
    red,
    redBright,
    strikethrough,
    underline,
    white,
    whiteBright,
    yellow,
    yellowBright,
} from "@visulima/colorize";
import { convertHexToRgb } from "@visulima/colorize/utils";

const out =
    `${bold`bold`} ${dim`dim`} ${italic`italic`} ${underline`underline`} ${strikethrough`strikethrough`} ${inverse`inverse`} ${bold.italic.underline
        .strike`bold italic  underline strike`}` +
    "\n" +
    `${red`red`} ${green`green`} ${yellow`yellow`} ${blue`blue`} ${magenta`magenta`} ${cyan`cyan`} ${white`white`} ${gray`gray`} ${bold.yellow`bold yellow`} ${dim.cyan`dim cyan`} ${red.italic`italic red`} ` +
    "\n" +
    `${black.bgRed`bgRed`} ${black.bgGreen`bgGreen`} ${black.bgYellow`bgYellow`} ${bgBlue`bgBlue`} ${black.bgMagenta`bgMagenta`} ${black.bgCyan`bgCyan`} ${black.bgWhite`bgWhite`} ${black.bgRedBright`bgRedBright`} ${white
        .bgRed.bold.italic` CocaCola `}` +
    "\n" +
    `${greenBright`greenBright`} ${yellowBright`yellowBright`} ${blueBright`blueBright`} ${magentaBright`magentaBright`} ${cyanBright`cyanBright`} ${whiteBright`whiteBright`} ${greenBright`A`}${magentaBright`N`}${yellowBright`S`}${redBright`I`}` +
    "\n" +
    `${black.bgGreenBright`bgGreenBright`} ${black.bgYellowBright`bgYellowBright`} ${bgBlueBright`bgBlueBright`} ${black.bgMagentaBright`bgMagentaBright`} ${black.bgCyanBright`bgCyanBright`} ${magentaBright.bgGreenBright`C`}${greenBright.bgMagentaBright`O`}${redBright.bgYellowBright`L`}${yellowBright.bgRedBright`O`}${redBright.bgCyanBright`R`}${yellowBright.bgBlueBright`S`}` +
    "\n" +
    ["#d93611", "#d97511", "#d9d611", "#a0d911", "#18d911", "#11d9c2", "#119dd9", "#1157d9", "#6614f6", "#c511d9", "#f10794"].reduce(
        (out, hex) => out + black.hex(hex)(hex),
        "",
    ) +
    "\n" +
    ["#d93611", "#d9d609", "#18d911", "#099dd9", "#7a09f6", "#c509d9", "#f10794"].reduce((out, hex) => {
        let [r, g, b] = convertHexToRgb(hex);

        return out + black.hex(hex)(`[${r},${g},${b}]`);
    }, "") +
    "\n" +
    [
        "#ff0000",
        "#ff0021",
        "#ff0041",
        "#ff0062",
        "#ff0082",
        "#ff00a3",
        "#ff00c3",
        "#ff00e4",
        "#fa00ff",
        "#d900ff",
        "#b900ff",
        "#9800ff",
        "#7800ff",
        "#5700ff",
        "#3700ff",
        "#1600ff",
        "#000bff",
        "#002bff",
        "#004cff",
        "#006cff",
        "#008dff",
        "#00adff",
        "#00ceff",
        "#00eeff",
        "#00ffef",
        "#00ffcf",
        "#00ffae",
        "#00ff8e",
        "#00ff6d",
        "#00ff4d",
        "#00ff2c",
        "#00ff0c",
        "#15ff00",
        "#36ff00",
        "#56ff00",
        "#77ff00",
        "#97ff00",
        "#b8ff00",
        "#d8ff00",
        "#f9ff00",
        "#ffe500",
        "#ffc400",
        "#ffa400",
        "#ff8300",
        "#ff6300",
        "#ff4200",
        "#ff2200",
        "#ff0100",
    ].reduce((out, hex) => out + black.hex(hex)("█"), "") +
    "\n" +
    [" 197 ", " 203 ", " 209 ", " 215 ", " 221 ", " 227 ", " 191 ", " 156  ", " 120  ", " 123 ", " 117 ", " 147 ", " 141 ", "  98 ", "  92 "].reduce(
        (out, code) => out + black.bgAnsi256(parseInt(code, 10))(code),
        "",
    ) +
    "\n ";

console.log(out);
