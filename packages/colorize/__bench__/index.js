//
// ATTENTION !!! ACHTUNG !!! MEGA ULTRA IMPORTANT !!! WICHTIG !!!
//
// For the correct measures, DO NOT use the same function instance inside the added benchmark:
// bench('Benchmark')
//   .add('bench1', () => anyFixture(arg1)) // <== only first measure of `anyFixture()` will be correct
//   .add('bench2', () => anyFixture(arg2)) // <== second and next measures of same function will be WRONG!
//
// Solution.
// Create the fixture as pure function and clone it for each added benchmark:
//
// const uniqFixture = [
//   clonePureFunction(anyFixture),
//   clonePureFunction(anyFixture),
//   ...
// ]
//
// or use:
// const uniqFixture = createFixture(arrayOfLibraries, anyFixture);
//
// bench('Benchmark')
//   .add('bench1', () => uniqFixture[0](arg1)) // <== the cloned function will be correct measured
//   .add('bench2', () => uniqFixture[1](arg2)) // <== the cloned function will be correct measured
//

"use strict";

import { Colorize, green, red, yellow } from "@visulima/colorize";
import { isStdoutColorSupported } from "@visulima/is-ansi-color-supported";
// vendor libraries for benchmark
import ansiColors from "ansi-colors";
import { Ansis } from "ansis";
import chalk from "chalk";
import cliColor from "cli-color";
import * as colorette from "colorette";
import colorsJs from "colors";
import colorCli from "colors-cli/color-safe";
import kleur from "kleur";
import * as kleurColors from "kleur/colors";
import picocolors from "picocolors";

import Bench from "./lib/bench.js";
import { createFixture } from "./lib/utils.js";

const colorSpace = isStdoutColorSupported();

if (colorSpace < 3) {
    console.warn(red.inverse` WARNING `, yellow`Your terminal don't support TrueColor!`);
    console.warn("The result of some tests can be NOT correct! Choose a modern terminal, e.g. iTerm.\n");
}

// create a new instance of Ansis for correct measure in benchmark
const ansis = new Ansis();

// create a new instance of Colorize for correct measure in benchmark
const colorize = new Colorize();

// All vendor libraries to be tested
const vendors = [
    { lib: colorize, name: "@visulima/colorize" },
    { lib: ansiColors, name: "ansi-colors" },
    { lib: ansis, name: "ansis" },
    { lib: cliColor, name: "cli-color" },
    { lib: colorCli, name: "color-cli" },
    { lib: colorsJs, name: "colors-js" },
    { lib: colorette, name: "colorette" },
    { lib: chalk, name: "chalk" },
    { lib: kleurColors, name: "kleur/colors" },
    { lib: kleur, name: "kleur" },
    { lib: picocolors, name: "picocolors" },
];

const benchStyle = new Ansis();
const bench = new Bench({
    benchNameColor: benchStyle.magenta,
    failColor: benchStyle.red.bold,
    minOpsWidth: 12,
    opsColor: benchStyle.greenBright,
    rmeColor: benchStyle.cyan,
    statUnitColor: benchStyle.dim,
    suiteNameColor: benchStyle.bgYellow.black,
});

// colors present in all libraries
const baseColors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

let fixture = [];

console.log(colorize.hex("#F88").inverse.bold` -= Benchmark =- `);

// Colorette bench
// https://github.com/jorgebucaran/colorette/blob/main/bench/index.js
fixture = createFixture(vendors, coloretteBench);

bench("Colorette bench")
    .add(vendors[0].name, () => fixture[0](vendors[0].lib))
    .add(vendors[1].name, () => fixture[1](vendors[1].lib))
    .add(vendors[2].name, () => fixture[2](vendors[2].lib))
    .add(vendors[3].name, () => fixture[3](vendors[3].lib))
    .add(vendors[4].name, () => fixture[4](vendors[4].lib))
    .add(vendors[5].name, () => fixture[5](vendors[5].lib))
    .add(vendors[6].name, () => fixture[6](vendors[6].lib))
    .add(vendors[7].name, () => fixture[7](vendors[7].lib))
    .add(vendors[8].name, () => fixture[8](vendors[8].lib))
    .add(vendors[9].name, () => fixture[9](vendors[9].lib))
    .add(vendors[10].name, () => fixture[10](vendors[9].lib))
    .run();

// Base colors
bench("Base colors")
    .add("@visulima/colorize", () => baseColors.forEach((style) => colorize[style]("foo")))
    .add("ansi-colors", () => baseColors.forEach((style) => ansiColors[style]("foo")))
    .add("ansis", () => baseColors.forEach((style) => ansis[style]("foo")))
    .add("chalk", () => baseColors.forEach((style) => chalk[style]("foo")))
    .add("cli-color", () => baseColors.forEach((style) => cliColor[style]("foo")))
    .add("color-cli", () => baseColors.forEach((style) => colorCli[style]("foo")))
    .add("colorette", () => baseColors.forEach((style) => colorette[style]("foo")))
    .add("colors-js", () => baseColors.forEach((style) => colorsJs[style]("foo")))
    .add("kleur", () => baseColors.forEach((style) => kleur[style]("foo")))
    .add("kleur/colors", () => baseColors.forEach((style) => kleurColors[style]("foo")))
    .add("picocolors", () => baseColors.forEach((style) => picocolors[style]("foo")))
    .run();

// Chained styles
bench("Chained styles")
    .add("@visulima/colorize", () => baseColors.forEach((style) => colorize[style].bold.underline.italic("foo")))
    .add("ansi-colors", () => baseColors.forEach((style) => ansiColors[style].bold.underline.italic("foo")))
    .add("ansis", () => baseColors.forEach((style) => ansis[style].bold.underline.italic("foo")))
    .add("chalk", () => baseColors.forEach((style) => chalk[style].bold.underline.italic("foo")))
    .add("cli-color", () => baseColors.forEach((style) => cliColor[style].bold.underline.italic("foo")))
    .add("color-cli", () => baseColors.forEach((style) => colorCli[style].bold.underline.italic("foo")))
    .add("colorette (not supported)", () => baseColors.forEach((style) => colorette[style].bold.underline.italic("foo")))
    .add("colors-js", () => baseColors.forEach((style) => colorsJs[style].bold.underline.italic("foo")))
    .add("kleur", () => baseColors.forEach((style) => kleur[style]().bold().underline().italic("foo"))) // alternate syntax
    .add("kleur/colors (not supported)", () => baseColors.forEach((style) => kleurColors[style].bold.underline.italic("foo")))
    .add("picocolors (not supported)", () => baseColors.forEach((style) => picocolors[style].bold.underline.italic("foo")))
    .run();

// Nested calls
bench("Nested calls")
    .add("@visulima/colorize", () => baseColors.forEach((style) => colorize[style](colorize.bold(colorize.underline(colorize.italic("foo"))))))
    .add("ansi-colors", () => baseColors.forEach((style) => ansiColors[style](ansiColors.bold(ansiColors.underline(ansiColors.italic("foo"))))))
    .add("ansis", () => baseColors.forEach((style) => ansis[style](ansis.bold(ansis.underline(ansis.italic("foo"))))))
    .add("chalk", () => baseColors.forEach((style) => chalk[style](chalk.bold(chalk.underline(chalk.italic("foo"))))))
    .add("cli-color", () => baseColors.forEach((style) => cliColor[style](cliColor.bold(cliColor.underline(cliColor.italic("foo"))))))
    .add("color-cli", () => baseColors.forEach((style) => colorCli[style](colorCli.bold(colorCli.underline(colorCli.italic("foo"))))))
    .add("colorette", () => baseColors.forEach((style) => colorette[style](colorette.bold(colorette.underline(colorette.italic("foo"))))))
    .add("colors-js", () => baseColors.forEach((style) => colorsJs[style](colorsJs.bold(colorsJs.underline(colorsJs.italic("foo"))))))
    .add("kleur", () => baseColors.forEach((style) => kleur[style](kleur.bold(kleur.underline(kleur.italic("foo"))))))
    .add("kleur/colors", () => baseColors.forEach((style) => kleurColors[style](kleurColors.bold(kleurColors.underline(kleurColors.italic("foo"))))))
    .add("picocolors", () => baseColors.forEach((style) => picocolors[style](picocolors.bold(picocolors.underline(picocolors.italic("foo"))))))
    .run();

// Nested styles
fixture = createFixture(vendors, nestedFixture);

bench("Nested styles")
    .add("@visulima/colorize", () => fixture[8](colorize))
    .add("ansi-colors", () => fixture[4](ansiColors))
    .add("ansis", () => fixture[8](ansis))
    .add("chalk", () => fixture[7](chalk))
    .add("cli-color", () => fixture[2](cliColor))
    .add("color-cli", () => fixture[3](colorCli))
    .add("colorette", () => fixture[0](colorette))
    .add("colors.js", () => fixture[9](colorsJs))
    .add("kleur", () => fixture[6](kleur))
    .add("kleur/colors", () => fixture[5](kleurColors))
    .add("picocolors", () => fixture[1](picocolors))
    .run();

// Deep nested styles
fixture = createFixture(vendors, deepNestedFixture);

bench("Deep nested styles")
    .add("@visulima/colorize", () => fixture[8](colorize))
    .add("ansi-colors", () => fixture[4](ansiColors))
    .add("ansis", () => fixture[8](ansis))
    .add("chalk", () => fixture[7](chalk))
    .add("cli-color", () => fixture[2](cliColor))
    .add("color-cli", () => fixture[3](colorCli))
    .add("colorette", () => fixture[0](colorette))
    .add("colors.js", () => fixture[9](colorsJs))
    .add("kleur", () => fixture[6](kleur))
    .add("kleur/colors", () => fixture[5](kleurColors))
    .add("picocolors", () => fixture[1](picocolors))
    .run();

// Check support of correct break style at new line

// Break style at new line
bench("New Line")
    .add("@visulima/colorize", () => colorize.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`))
    .add("ansi-colors", () => ansiColors.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`))
    .add("ansis", () => ansis.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`))
    .add("chalk", () => chalk.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`))
    .add("colors.js", () => colorsJs.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`))
    .run();

bench("RGB colors")
    .add("@visulima/colorize", () => {
        for (let index = 0; index < 256; index++) colorize.rgb(index, 150, 200)("foo");
    })
    .add("ansis", () => {
        for (let index = 0; index < 256; index++) ansis.rgb(index, 150, 200)("foo");
    })
    .add("chalk", () => {
        for (let index = 0; index < 256; index++) chalk.rgb(index, 150, 200)("foo");
    })
    .run();

// HEX colors
// the hex(), rgb(), bgHex(), bgRgb() methods support only chalk and ansis
bench("HEX colors")
    .add("@visulima/colorize", () => colorize.hex("#FBA")("foo"))
    .add("ansis", () => ansis.hex("#FBA")("foo"))
    .add("chalk", () => chalk.hex("#FBA")("foo"))
    .run();

// Spectrum HEX colors
bench("Spectrum HEX colors")
    .add("chalk", () => {
        let str = "";
        spectrum.forEach((color) => {
            str += chalk.hex(color)("█");
        });
        return str;
    })
    .add("ansis", () => {
        let str = "";
        spectrum.forEach((color) => {
            str += hex(color)("█");
        });
        return str;
    })
    .run();

// Template literals
bench("Template literals")
    .add("@visulima/colorize", () => red`red ${yellow`yellow ${green`green`} yellow`} red`)
    .add("ansis", () => red`red ${yellow`yellow ${green`green`} yellow`} red`)
    .run();

// Tagged Template Literals
bench("Tagged Template literals")
    .add("@visulima/colorize", () => colorize`{bold Hello, {cyan World!} This is a} test. {green Woo!}`)
    .add("ansis", () => chalk`{bold Hello, {cyan World!} This is a} test. {green Woo!}`)
    .run();

function coloretteBench(c) {
    return c.red(`${c.bold(`${c.cyan(`${c.yellow("yellow")}cyan`)}`)}red`);
}

function nestedFixture(c) {
    return c.red(
        `a red ${c.white("white")} red ${c.red("red")} red ${c.cyan("cyan")} red ${c.black("black")} red ${c.red("red")} red ${c.green("green")} red ${c.red(
            "red",
        )} red ${c.yellow("yellow")} red ${c.blue("blue")} red ${c.red("red")} red ${c.magenta("magenta")} red ${c.red("red")} red ${c.red("red")} red ${c.red(
            "red",
        )} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red(
            "red",
        )} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.green("green")} red ${c.red(
            "red",
        )} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red(
            "red",
        )} red ${c.red("red")} red ${c.red("red")} red ${c.magenta("magenta")} red ${c.red("red")} red ${c.red("red")} red ${c.cyan("cyan")} red ${c.red(
            "red",
        )} red ${c.red("red")} red ${c.yellow("yellow")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red(
            "red",
        )} red ${c.red("red")} red ${c.red("red")} message`,
    );
}

function deepNestedFixture(c) {
    return c.green(
        `green ${c.cyan(
            `cyan ${c.red(
                `red ${c.yellow(
                    `yellow ${c.blue(`blue ${c.magenta(`magenta ${c.underline(`underline ${c.italic(`italic`)} underline`)} magenta`)} blue`)} yellow`,
                )} red`,
            )} cyan`,
        )} green`,
    );
}
