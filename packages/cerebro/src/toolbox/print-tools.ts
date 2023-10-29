import chalkAnimation from "chalk-animation";
import type { Options as OraOptions, Ora } from "ora";
import ora from "ora";
import terminalLink from "terminal-link";
import boxen from "boxen";

import type { Print as IPrint } from "../@types";
import { VERBOSITY_QUIET } from "../constants";
import clear from "../ui/clear";
import colors from "../ui/colors";
import { justify, truncate,wrap } from "../ui/helpers";
import { multiProgress,progress } from "../ui/progress";
import table from "../ui/table";
import terminalSize from "../ui/terminal-size";
import instructions from "../ui/instructions";

/**
 * Print a blank line.
 */
const newline = (): void => {
    console.log("");
};

/**
 * Prints a divider line
 */
const divider = (): void => {
    // eslint-disable-next-line no-console
    console.log(colors.line("---------------------------------------------------------------"));
};

/**
 * Creates an Ora spinner.
 */
const spinner = (config?: OraOptions | string): Ora => ora(config);

const log = (arguments_: any, type: "debug" | "error" | "info" | "log" | "warn" = "log"): void => {
    if (process.env["NODE_ENV"] === "test" || Number(process.env["CEREBRO_OUTPUT"]) === VERBOSITY_QUIET) {
        return;
    }

    // eslint-disable-next-line no-console,security/detect-object-injection
    console[type](arguments_);
};

export default {
    animation: chalkAnimation,
    boxen,
    clear,
    colors,
    divider,
    instructions,
    justify,
    link: terminalLink,
    multiProgress,
    newline,
    print: log,
    progress,
    spinner,
    table,
    terminalSize,
    truncate,
    wrap,
} as IPrint;


