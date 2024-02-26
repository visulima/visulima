/**
 * This is a modified copy of the rainbow.js from chalk.
 * @see https://github.com/chalk/chalk/blob/main/examples/rainbow.js
 *
 * MIT License
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 */
import { setTimeout as delay } from "node:timers/promises";
import convertColor from "color-convert";
import updateLog from "log-update";
import colorize from "@visulima/colorize";

const ignoreChars = /[^!-~]/g;

function rainbow(string, offset) {
    if (!string || string.length === 0) {
        return string;
    }

    const hueStep = 360 / string.replace(ignoreChars, "").length;

    let hue = offset % 360;
    const characters = [];
    for (const character of string) {
        if (ignoreChars.test(character)) {
            characters.push(character);
        } else {
            characters.push(colorize.hex(convertColor.hsl.hex(hue, 100, 50))(character));
            hue = (hue + hueStep) % 360;
        }
    }

    return characters.join("");
}

async function animateString(string) {
    for (let index = 0; index < 360 * 5; index++) {
        updateLog(rainbow(string, index));
        await delay(2); // eslint-disable-line no-await-in-loop
    }
}

console.log("");
await animateString("We hope you enjoy @visulima/colorize! <3");
console.log("");
