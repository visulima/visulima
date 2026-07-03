"use strict";

import { Colorize } from "@visulima/colorize";
import ansiColors from "ansi-colors";
import { Ansis } from "ansis";
// vendor libraries for benchmark
import chalk from "chalk";
import cliColor from "cli-color";
import * as colorette from "colorette";
import colorsJs from "colors";
import kleur from "kleur";
import * as kleurColors from "kleur/colors";
import picocolors from "picocolors";

const { log } = console;

// create a new instance of Ansis for correct measure in benchmark
const ansis = new Ansis();

// create a new instance of Colorize for correct measure in benchmark
const colorize = new Colorize();

log(colorize.hex("#F88").inverse.bold` -= Benchmark =- `);

log(` -= Deep Nested Styling =- `);

showSupportOfDeepNestedStyling();

log(` -= Deep Nested Chained Styling =- `);

showSupportOfDeepNestedChainedStyling();

log(` -= Break Style At NewLine =- `);

showSupportOfBreakStyleAtNewLine();

// Supports the template literals
log(chalk.red`red ${chalk.yellow`yellow ${chalk.green`green`} yellow`} red`); // fail
log(kleur.red`red ${kleur.yellow`yellow ${kleur.green`green`} yellow`} red`); // fail
log(colorsJs.red`red ${colorsJs.yellow`yellow ${colorsJs.green`green`} yellow`} red`); // fail
log(colorette.red`red ${colorette.yellow`yellow ${colorette.green`green`} yellow`} red`); // fail
log(ansiColors.red`red ${ansiColors.yellow`yellow ${ansiColors.green`green`} yellow`} red`); // fail
log(cliColor.red`red ${cliColor.yellow`yellow ${cliColor.green`green`} yellow`} red`); // fail
// log(colorCli.red`red ${colorCli.yellow`yellow ${colorCli.green`green`} yellow`} red`); // fail
log(picocolors.red`red ${picocolors.yellow`yellow ${picocolors.green`green`} yellow`} red`); // fail
log(ansis.red`red ${ansis.yellow`yellow ${ansis.green`green`} yellow`} red`); // OK
log(colorize.red`red ${colorize.yellow`yellow ${colorize.green`green`} yellow`} red`); // OK

/**
 *
 * @param c
 */
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

/**
 *
 * @param c
 */
function complexNestedFixture(c) {
    return c.red(
        `red ${c.yellow("yellow")} red ${c.italic.cyan("italic cyan")} red ${c.underline.green(
            `underline green ${c.yellow("underline yellow")} underline green`,
        )} red ${c.cyan("cyan")} red ${c.bold.yellow("bold yellow")} red ${c.green("green")} red`,
    );
}

/**
 *
 */
function showSupportOfDeepNestedStyling() {
    log("logcolors.js: ", deepNestedFixture(colorsJs));
    log("logcolorette: ", deepNestedFixture(colorette));
    log("picocolors: ", deepNestedFixture(picocolors));
    log("cli-color: ", deepNestedFixture(cliColor));
    // log("color-cli: ", deepNestedFixture(colorCli)); // buggy
    log("ansi-colors: ", deepNestedFixture(ansiColors));
    log("kleur/colors: ", deepNestedFixture(kleurColors));
    log("kleur: ", deepNestedFixture(kleur));
    log("chalk: ", deepNestedFixture(chalk));
    log("ansis: ", deepNestedFixture(ansis));
    log("@visulima/colorize: ", deepNestedFixture(colorize));
}

/**
 *
 */
function showSupportOfDeepNestedChainedStyling() {
    log("chalk: ", complexNestedFixture(chalk));
    log("ansis: ", complexNestedFixture(ansis));
    log("@visulima/colorize: ", complexNestedFixture(colorize));
}

/**
 *
 */
function showSupportOfBreakStyleAtNewLine() {
    log("colors.js: ", colorsJs.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // OK
    log("colorette: ", colorette.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // (not supported)
    log("picocolors: ", picocolors.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // (not supported)
    log("cli-color: ", cliColor.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // (not supported)
    // log("color-cli: ", colorCli.green_b(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // (not supported)
    log("ansi-colors: ", ansiColors.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // OK
    log("kleur/colors: ", kleurColors.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // (not supported)
    log("kleur: ", kleur.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // (not supported)
    log("chalk: ", chalk.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // OK
    log("ansis: ", ansis.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // OK
    log("@visulima/colorize: ", colorize.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`)); // OK
}
